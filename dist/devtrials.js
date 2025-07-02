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
const constants_1 = require("./constants/constants");
const dotenv = __importStar(require("dotenv"));
const mongodb_1 = require("mongodb");
const enc_db_1 = require("./enc_db");
const t = __importStar(require("tmp"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const identity_1 = require("@azure/identity");
const keyvault_keys_1 = require("@azure/keyvault-keys");
const dekmanager_1 = require("./dekmanager");
const uuid = __importStar(require("uuid"));
const archiver_1 = __importDefault(require("archiver"));
dotenv.config();
function f(app) {
    try {
        if (app) {
            app.get("/dev/try/eta", async (req, res) => {
                try {
                    const eta = await getETA(enc_db_1.client);
                    const id = uuid.v4();
                    startSnapshot(enc_db_1.client, id);
                    res.send(eta);
                }
                catch (err) {
                    res.send(err);
                }
            });
            app.get("/dev/s", async (req, res) => {
                try {
                    const s = getSize();
                    res.send(s);
                }
                catch (err) {
                    res.send(err);
                }
            });
            app.get(("/dev/st"), async (req, res) => {
                try {
                    res.json(snapshots);
                }
                catch (error) {
                    res.send(error);
                }
            });
            app.get("/dev/d", async (req, res) => {
                try {
                    const s = outputZipPath;
                    res.download(s);
                }
                catch (err) {
                    res.send(err);
                }
            });
            app.get("/k", async (req, res) => {
                try {
                    const s = getKeys();
                    res.send(s);
                }
                catch (err) {
                    res.send(err);
                }
            });
        }
    }
    catch (err) {
    }
}
async function getFullMongoDump() {
    let dump = {};
    const adminDb = enc_db_1.client.db().admin();
    // Get all database names
    const dbs = await adminDb.listDatabases();
    let i = 0;
    for (const dbInfo of dbs.databases) {
        const dbName = dbInfo.name;
        const db = enc_db_1.client.db(dbName);
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
const outputZipPath = `${t0}/srv/cluster0.zip`;
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
async function zipClusterFolder() {
    makedirIfNotExist(path.dirname(outputZipPath));
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputZipPath);
        const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
        output.on('close', () => {
            console.log(`ZIP file created at ${outputZipPath} (${archive.pointer()} total bytes)`);
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
async function getKeys() {
    const url = constants_1.AZURE_KEY_VAULT_ENDPOINT;
    const credential = new identity_1.DefaultAzureCredential();
    const client = new keyvault_keys_1.KeyClient(url, credential);
}
async function getEncryptedDEKs(keyVaultNamespace) {
    await enc_db_1.client.connect();
    const [dbName, collName] = keyVaultNamespace.split('.');
    const keyVaultColl = enc_db_1.client.db(dbName).collection(collName);
    const keys = await keyVaultColl.find({}).toArray();
    await enc_db_1.client.close();
    return keys.map(key => ({
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
function _(connectionString, kmsProviders) {
    console.log(connectionString);
    var mongoClient = new mongodb_1.MongoClient(connectionString, {
        monitorCommands: true,
        autoEncryption: {
            keyVaultNamespace: enc_db_1.EncryptedMongoClient.keyVaultNamespace,
            kmsProviders,
            // Attach schemaMap to auto-encryption configuration
        },
    });
    console.log("generationStarted");
    (0, dekmanager_1.generateCsfleSchema)(kmsProviders).then(console.log);
}
const kmsProviders = () => {
    // Azure KMS Configuration (should be secured and configured)
    const azureKMS = {
        tenantId: constants_1.AZURE_TENANT_ID,
        clientId: constants_1.AZURE_CLIENT_ID,
        clientSecret: constants_1.AZURE_CLIENT_SECRET,
        keyName: constants_1.AZURE_KEY_NAME,
        keyVaultEndpoint: constants_1.AZURE_KEY_VAULT_ENDPOINT,
    };
    // KMS Providers Configuration for Azure
    const kmsProviders = {
        azure: {
            tenantId: azureKMS.tenantId,
            clientId: azureKMS.clientId,
            clientSecret: azureKMS.clientSecret,
            identityPlatformEndpoint: 'login.microsoftonline.com', // Standard Azure login endpoint
        },
    };
    return kmsProviders;
};
_(dekmanager_1.MONGO_URI, kmsProviders());
//testDecryptAllKeys().catch(console.error);

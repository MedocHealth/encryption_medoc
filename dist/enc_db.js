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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptedMongoClient = exports.client = void 0;
exports.generateCSFLESchemaMapForDBs = generateCSFLESchemaMapForDBs;
const mongodb_1 = require("mongodb");
const devtrials_1 = require("./utils/devtrials");
const fs = __importStar(require("fs"));
const p = __importStar(require("path"));
const constants_1 = require("./constants/constants");
const dekmanager_1 = require("./dekmanager");
const dotenv = __importStar(require("dotenv"));
const ass = __importStar(require("assert"));
dotenv.config(); //configDotenv();
class EncryptedMongoClient {
    constructor(app) {
        ass.ok(app, "Insufficient paramenter to the constructor");
        EncryptedMongoClient.a0 = app;
        this.mongoClient = null;
        EncryptedMongoClient.keyVaultNamespace = constants_1.KEY_VAULT_NAMESPACE; // hardcoded for your control
        (0, devtrials_1.f)(app);
        // console.log("schema Map", JSON.stringify(generateCSFLESchemaMapForDBs()))
    }
    async init(url, options) {
        if (!EncryptedMongoClient.a0) {
            throw new Error('MongoClient is not initialized: HTTP server not provided');
        }
        if (!url || url.trim() === '') {
            throw new Error('DB Coonection string must not be null, undefined, or empty');
        }
        // Default connection string if none is provided
        const connectionString = url ?? 'mongodb+srv://<user>:<pass>@<cluster>.mongodb.net';
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
        // Initialize a client for Key Vault to manage encryption keys
        const keyVaultClient = new mongodb_1.MongoClient(connectionString, options);
        await keyVaultClient.connect();
        const keyVault = keyVaultClient.db(constants_1.KEYVALUT_DB).collection(constants_1.KEYVALUT_COLLECTION);
        keyVault.createIndex({ keyAltNames: 1 }, {
            unique: true,
            partialFilterExpression: { keyAltNames: { $exists: true } },
        }).catch(() => { });
        // Create or retrieve an existing Data Encryption Key (DEK)
        let dataKeyId;
        const existingKey = await keyVault.findOne({});
        // Define schemaMap for field-level encryption
        const schemaMap = await (0, dekmanager_1.generateCsfleSchema)(kmsProviders);
        let t = {
            'myColl': {
                bsonType: 'object',
                encryptMetadata: {
                    keyId: [dataKeyId], // Reference the created or existing key
                },
                properties: {
                    sensitiveField: {
                        encrypt: {
                            bsonType: 'string',
                            algorithm: 'Algorithm.AEAD_AES_256_CBC_HMAC_SHA_512_Deterministic', // Deterministic encryption
                        },
                    },
                },
            },
        };
        // Initialize the MongoDB client with autoEncryption enabled
        this.mongoClient = new mongodb_1.MongoClient(connectionString, {
            monitorCommands: true,
            autoEncryption: {
                keyVaultNamespace: EncryptedMongoClient.keyVaultNamespace,
                kmsProviders,
                schemaMap, // Attach schemaMap to auto-encryption configuration
            },
        });
        this.mongoClient.connect();
        // Assign to the global client variable
        exports.client = this.mongoClient;
        console.log('MongoDB client initialized with CSFLE and Azure Key Vault integration');
        // Optional: Return the client instance for use in other parts of your application
        return this.mongoClient;
    }
    getClient() {
        return this.mongoClient;
    }
}
exports.EncryptedMongoClient = EncryptedMongoClient;
/**
 * Generates schema map for one or more DBs from a shared schema definition.
  * @returns MongoDB CSFLE-compliant schema map
 */
async function generateCSFLESchemaMapForDBs(client) {
    //console.log(__dirname);
    const respath = p.resolve(__dirname, "../conf/schema.json");
    const raw = fs.readFileSync(respath, 'utf-8');
    const sharedSchema = JSON.parse(raw);
    const schemaMap = {};
    for (const [collectionName, fields] of Object.entries(sharedSchema)) {
        // console.log(collectionName);
        const properties = {};
        const dataKey = await client?.createDataKey('azure', {
            masterKey: {
                keyVaultEndpoint: 'https://medoc-key-vault.vault.azure.net/',
                keyName: 'medoc-key',
                keyVersion: 'feacb7e500ad466b98539f60ce490355'
            }
        });
        for (const [fieldName, bsonType] of Object.entries(fields)) {
            properties[fieldName] = {
                encrypt: {
                    bsonType,
                    algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic",
                    test: fieldName
                }
            };
        }
        const namespace = `${collectionName}`;
        schemaMap[namespace] = {
            bsonType: "object",
            encryptMetadata: {
                keyId: [dataKey?.toString('base64')]
            },
            properties
        };
    }
    return schemaMap;
}
//generateCSFLESchemaMapForDBs().then((res) => console.log(res));

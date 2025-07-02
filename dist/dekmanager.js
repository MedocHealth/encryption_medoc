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
exports.MONGO_URI = void 0;
exports.ensureDekForField = ensureDekForField;
exports.createIndexesOnKeyVault = createIndexesOnKeyVault;
exports.generateCsfleSchema = generateCsfleSchema;
const fs_1 = __importDefault(require("fs"));
const p = __importStar(require("path"));
const mongodb_1 = require("mongodb");
const constants_1 = require("./constants/constants");
async function ensureDekForField(client, kmsProviders, fieldKeyAltName) {
    //return uuid.v4();
    await client.connect();
    const keyVault = client.db(constants_1.KEYVALUT_DB).collection(constants_1.KEYVALUT_COLLECTION);
    // Check if DEK already exists
    const existingKey = await keyVault.findOne({ keyAltNames: fieldKeyAltName });
    if (existingKey) {
        return existingKey?._id.toString('base64');
    }
    const encryption = new mongodb_1.ClientEncryption(client, {
        keyVaultNamespace: constants_1.KEY_VAULT_NAMESPACE,
        kmsProviders: kmsProviders,
    });
    // Create new DEK for this field
    const dekId = await encryption.createDataKey('azure', {
        masterKey: {
            keyName: constants_1.AZURE_KEY_NAME,
            keyVaultEndpoint: constants_1.AZURE_KEY_VAULT_ENDPOINT
        },
        keyAltNames: [fieldKeyAltName]
    });
    await client.close();
    console.log(`Created DEK for ${fieldKeyAltName}`);
    return dekId.toString('base64');
}
async function createIndexesOnKeyVault(client) {
    const keyVault = client.db(constants_1.KEYVALUT_DB).collection(constants_1.KEYVALUT_COLLECTION);
    await keyVault.createIndex({ keyAltNames: 1 }, { unique: true });
    await keyVault.createIndex({ _id: 1 });
}
const bsonTypeMap = {
    String: 'string',
    Number: 'int',
    Boolean: 'bool',
    Date: 'date',
    Object: 'object',
    Array: 'array'
};
const password = encodeURIComponent("Atlas_Medoc");
const username = encodeURIComponent("team_medoc");
const host = encodeURIComponent("dbhospital.kfabsde.mongodb.net");
const options = "retryWrites=true&w=majority&appName=DBHospital";
exports.MONGO_URI = process.env.Node_env === "Prod" ? process.env.Prod_MongoURL : `mongodb+srv://${username}:${password}@${host}/?${options}`;
async function generateCsfleSchema(kmsProviders) {
    const p0 = p.join(__dirname, "../conf/schema.json");
    const jsonArray = JSON.parse(fs_1.default.readFileSync(p0, 'utf-8'));
    const schemaMap = {};
    const client = new mongodb_1.MongoClient(exports.MONGO_URI);
    //await client.connect();
    await createIndexesOnKeyVault(client);
    for (const collectionDef of jsonArray) {
        const [collectionNam] = Object.keys(collectionDef);
        const fields = collectionDef[collectionNam];
        //  const properties: Record<string, any> = {};
        for (const collectionDef of jsonArray) {
            const [collectionName] = Object.keys(collectionDef);
            const fields = collectionDef[collectionName];
            const properties = {};
            for (const [fieldName, type] of Object.entries(fields)) {
                const fieldType = Array.isArray(type) ? 'array' : type.toLowerCase();
                const algo = 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic';
                const altName = `${collectionName}.${fieldName}`;
                const dekId = await ensureDekForField(client, kmsProviders, altName);
                if (fieldType === 'array') {
                    properties[fieldName] = {
                        bsonType: 'array',
                        items: {
                            bsonType: 'string',
                            encrypt: {
                                keyId: [dekId],
                                bsonType: 'string',
                                algorithm: algo
                            }
                        }
                    };
                }
                else {
                    properties[fieldName] = {
                        bsonType: 'string',
                        encrypt: {
                            bsonType: 'string',
                            algorithm: algo
                        }
                    };
                }
                // console.log(fieldName, properties[fieldName])
            }
            // console.log(properties)
            schemaMap[collectionName] || (schemaMap[collectionName] = {
                bsonType: 'object',
                properties
            });
        }
        // for (const [fieldName, fieldType] of Object.entries(fields)) {
        //     const altName = `${collectionName}.${fieldName}`;
        //     const dekId = await ensureDekForField(client, kmsProviders, altName);
        //     let bsonType: string;
        //     let schemaField: any;
        //     if (Array.isArray(fieldType)) {
        //         // Array field
        //         bsonType = bsonTypeMap[fieldType[0]] || 'string';
        //         schemaField = {
        //             bsonType: 'array',
        //             encrypt: {
        //                 bsonType,
        //                 algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic',
        //                 keyId: [dekId]
        //             }
        //         };
        //     } else {
        //         bsonType = bsonTypeMap[fieldType] || 'string';
        //         schemaField = {
        //             encrypt: {
        //                 bsonType,
        //                 algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic',
        //                 keyId: [dekId]
        //             }
        //         };
        //     }
        //     properties[fieldName] = schemaField;
        // }
        // const ns = `${collectionName}`;
        // schemaMap[ns] = {
        //     bsonType: 'object',
        //     properties
        // };
        console.log(collectionNam);
    }
    // await client.close();
    return schemaMap;
}

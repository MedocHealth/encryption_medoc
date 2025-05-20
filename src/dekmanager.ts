
import fs from 'fs';
import * as p from "path";
import { ClientEncryption, KMSProviders, MongoClient } from "mongodb";
import { AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_KEY_NAME, AZURE_KEY_VAULT_ENDPOINT, AZURE_TENANT_ID, KEY_VAULT_NAMESPACE, KEYVALUT_COLLECTION, KEYVALUT_DB } from "./constants/constants";
import { EncryptedMongoClient } from './enc_db';
import * as uuid from 'uuid';
export async function ensureDekForField(client: MongoClient, kmsProviders: KMSProviders, fieldKeyAltName: string): Promise<String | undefined> {
    //return uuid.v4();
    await client.connect();
    const keyVault = client.db(KEYVALUT_DB).collection(KEYVALUT_COLLECTION);

    // Check if DEK already exists
    const existingKey = await keyVault.findOne({ keyAltNames: fieldKeyAltName });
    if (existingKey) {
        return existingKey?._id.toString('base64');
    }
    const encryption = new ClientEncryption(client, {
        keyVaultNamespace: KEY_VAULT_NAMESPACE,
        kmsProviders: kmsProviders,
    })
    // Create new DEK for this field
    const dekId = await encryption.createDataKey('azure', {
        masterKey: {
            keyName: AZURE_KEY_NAME,
            keyVaultEndpoint: AZURE_KEY_VAULT_ENDPOINT
        },
        keyAltNames: [fieldKeyAltName]
    });
    await client.close();
    console.log(`Created DEK for ${fieldKeyAltName}`);
    return dekId.toString('base64');
}

export async function createIndexesOnKeyVault(client: MongoClient) {
    const keyVault = client.db(KEYVALUT_DB).collection(KEYVALUT_COLLECTION);
    await keyVault.createIndex({ keyAltNames: 1 }, { unique: true });
    await keyVault.createIndex({ _id: 1 });
}


type FieldMap = { [key: string]: string };
type CollectionSchema = { [collectionName: string]: FieldMap };
type JsonSchema = { [key: string]: any };

const bsonTypeMap: Record<string, string> = {
    String: 'string',
    Number: 'int',
    Boolean: 'bool',
    Date: 'date',
    Object: 'object',
    Array: 'array'
};

const password = encodeURIComponent("Atlas_Medoc")
const username = encodeURIComponent("team_medoc")
const host = encodeURIComponent("dbhospital.kfabsde.mongodb.net")
const options = "retryWrites=true&w=majority&appName=DBHospital"
export const MONGO_URI = process.env.Node_env === "Prod" ? process.env.Prod_MongoURL as string : `mongodb+srv://${username}:${password}@${host}/?${options}`;

async function generateCsfleSchema(kmsProviders: KMSProviders) {
    const p0 = p.join(__dirname, "../conf/schema.json");
    const jsonArray: CollectionSchema[] = JSON.parse(fs.readFileSync(p0, 'utf-8'));
    const schemaMap: Record<string, JsonSchema> = {};
    const client = new MongoClient(MONGO_URI);
    //await client.connect();
    await createIndexesOnKeyVault(client);

    for (const collectionDef of jsonArray) {
        console.log(collectionDef);
        const [collectionName] = Object.keys(collectionDef);
        const fields = collectionDef[collectionName];

        //  const properties: Record<string, any> = {};
        for (const collectionDef of jsonArray) {
            const [collectionName] = Object.keys(collectionDef);
            const fields = collectionDef[collectionName];
            const properties: Record<string, any> = {};

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
                    }
                } else {
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
            schemaMap[collectionName] = {
                bsonType: 'object',
                properties
            };
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
        console.log(collectionName)
    }

    // await client.close();
    return schemaMap;
}

function _(connectionString: string, kmsProviders: KMSProviders,) {
    console.log(connectionString)
    var mongoClient = new MongoClient(connectionString, {
        monitorCommands: true,
        autoEncryption: {
            keyVaultNamespace: EncryptedMongoClient.keyVaultNamespace,
            kmsProviders,
            // Attach schemaMap to auto-encryption configuration
        },
    });
    console.log("generationStarted")
    generateCsfleSchema(kmsProviders).then(console.log);
}
const kmsProviders: KMSProviders = {
    azure: {
        tenantId: AZURE_TENANT_ID,
        clientId: AZURE_CLIENT_ID,
        clientSecret: AZURE_CLIENT_SECRET,
        identityPlatformEndpoint: 'login.microsoftonline.com', // Standard Azure login endpoint
    },
}
_(MONGO_URI, kmsProviders);
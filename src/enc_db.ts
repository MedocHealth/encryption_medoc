import { MongoClient, ClientEncryption, KMSProviders } from 'mongodb';
import { Application } from 'express';
import { f } from './devtrials';
import * as dotenv from 'dotenv';
dotenv.config();//configDotenv();
export let client: MongoClient;
export class EncryptedMongoClient {
    public static a0: Application;
    mongoClient: MongoClient | null;
    static keyVaultNamespace: string;

    constructor(app: Application) {

        EncryptedMongoClient.a0 = app;
        this.mongoClient = null;
        EncryptedMongoClient.keyVaultNamespace = KEY_VAULT_NAMESPACE; // hardcoded for your control
        f(app)
        // console.log("schema Map", JSON.stringify(generateCSFLESchemaMapForDBs()))
    }

    async init(url: string) {
        if (!EncryptedMongoClient.a0) {
            throw new Error('MongoClient is not initialized: HTTP server not provided');
        }

        // Default connection string if none is provided
        const connectionString = url ?? 'mongodb+srv://<user>:<pass>@<cluster>.mongodb.net';


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

        // Initialize a client for Key Vault to manage encryption keys
        const keyVaultClient = new MongoClient(connectionString);
        await keyVaultClient.connect();
        const keyVault = keyVaultClient.db(KEYVALUT_DB).collection(KEYVALUT_COLLECTION);
        keyVault.createIndex({ keyAltNames: 1 },
            {
                unique: true,
                partialFilterExpression: { keyAltNames: { $exists: true } },
            }).catch(() => { });
        // Create or retrieve an existing Data Encryption Key (DEK)
        let dataKeyId: any;
        const existingKey = await keyVault.findOne({});



        // Define schemaMap for field-level encryption
        const schemaMap = {
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
        this.mongoClient = new MongoClient(connectionString, {
            monitorCommands: true,
            autoEncryption: {
                keyVaultNamespace: EncryptedMongoClient.keyVaultNamespace,
                kmsProviders,
                schemaMap, // Attach schemaMap to auto-encryption configuration
            },
        });

        // Assign to the global client variable
        EncryptedMongoClient.a0.locals.mongoClient = this.mongoClient;
        await this.mongoClient.connect();
        console.log('MongoDB client initialized with CSFLE and Azure Key Vault integration');

        // Optional: Return the client instance for use in other parts of your application
        return this.mongoClient;
    }


    getClient() {
        return this.mongoClient;
    }

}



import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid'; // for generating key UUIDs (mock)
import * as p from 'path';
import { AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_KEY_NAME, AZURE_KEY_VAULT_ENDPOINT, AZURE_TENANT_ID, KEY_VAULT_NAMESPACE, KEYVALUT_COLLECTION, KEYVALUT_DB } from './constants/constants';


type CollectionSchema = Record<string, string>;
type InputSchema = Record<string, CollectionSchema>;

/**
 * Generates schema map for one or more DBs from a shared schema definition.
  * @returns MongoDB CSFLE-compliant schema map
 */
export async function generateCSFLESchemaMapForDBs(client?: ClientEncryption): Promise<Record<string, any>> {
    //console.log(__dirname);
    const respath = p.resolve(__dirname, "../conf/schema.json")
    const raw = fs.readFileSync(respath, 'utf-8');
    const sharedSchema: InputSchema = JSON.parse(raw);

    const schemaMap: Record<string, any> = {};

    for (const [collectionName, fields] of Object.entries(sharedSchema)) {
       // console.log(collectionName);
        const properties: Record<string, any> = {};
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
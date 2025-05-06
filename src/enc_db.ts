import { MongoClient, ClientEncryption, KMSProviders } from 'mongodb';
import { Application } from 'express';
import { f } from './devtrials';

export let client: MongoClient;

export class EncryptedMongoClient {
    public static a0: Application;
    mongoClient: MongoClient | null;
    static keyVaultNamespace: string;
    dataKeyAltName: string;

    constructor(app: Application) {

        EncryptedMongoClient.a0 = app;
        this.mongoClient = null;
        EncryptedMongoClient.keyVaultNamespace = 'encryption.__keyVault'; // hardcoded for your control
        this.dataKeyAltName = 'myDataKey'; // friendly name for easier key management
        f(app)
        console.log("schema Map", JSON.stringify(generateCSFLESchemaMapForDBs("", ["heelo"])))
    }

    async init(url: string) {
        if (!EncryptedMongoClient.a0) {
            throw new Error('MongoClient is not initialized: HTTP server not provided');
        }

        // Default connection string if none is provided
        const connectionString = url ?? 'mongodb+srv://<user>:<pass>@<cluster>.mongodb.net';

        // Azure KMS Configuration (should be secured and configured)
        const azureKMS = {
            tenantId: '<your-azure-tenant-id>',
            clientId: '<your-azure-client-id>',
            clientSecret: '<your-azure-client-secret>',
            keyName: '<your-key-name>',
            keyVaultEndpoint: '<your-key-vault-name>.vault.azure.net',
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
        const keyVault = keyVaultClient.db('encryption').collection('__keyVault');

        // Create or retrieve an existing Data Encryption Key (DEK)
        let dataKeyId: any;
        const existingKey = await keyVault.findOne({ keyAltNames: [this.dataKeyAltName] });

        if (existingKey) {
            // Use existing key if available
            dataKeyId = existingKey._id;
        } else {
            // Create a new key if it doesn't exist
            const encryption = new ClientEncryption(keyVaultClient, {
                keyVaultNamespace: EncryptedMongoClient.keyVaultNamespace,
                kmsProviders,
            });

            dataKeyId = await encryption.createDataKey('azure', {
                masterKey: {
                    keyName: azureKMS.keyName,
                    keyVaultEndpoint: azureKMS.keyVaultEndpoint,
                },
                keyAltNames: [this.dataKeyAltName],
            });
        }

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
    static h() {
        return EncryptedMongoClient.a0;
    }
}



import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid'; // for generating key UUIDs (mock)
import * as p from 'path';

// Replace with your actual keyId from your key vault
const defaultKeyId = {
    "$binary": {
        "base64": Buffer.from(uuidv4().replace(/-/g, ''), 'hex').toString('base64'),
        "subType": "04"
    }
};

type CollectionSchema = Record<string, string>;
type InputSchema = Record<string, CollectionSchema>;

/**
 * Generates schema map for one or more DBs from a shared schema definition.
 * @param schemaJsonPath Path to the schema JSON file
 * @param dbNames Array of DB names to generate schema map for
 * @returns MongoDB CSFLE-compliant schema map
 */
export function generateCSFLESchemaMapForDBs(schemaJsonPath: string, dbNames: string[]): Record<string, any> {
    console.log(__dirname);
    const respath = p.resolve(__dirname, "../conf/schema.json")
    const raw = fs.readFileSync(respath, 'utf-8');
    const sharedSchema: InputSchema = JSON.parse(raw);

    const schemaMap: Record<string, any> = {};

    for (const [collectionName, fields] of Object.entries(sharedSchema)) {
        const properties: Record<string, any> = {};

        for (const [fieldName, bsonType] of Object.entries(fields)) {
            properties[fieldName] = {
                encrypt: {
                    bsonType,
                    algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic"
                }
            };
        }

        const namespace = `${collectionName}`;
        schemaMap[namespace] = {
            bsonType: "object",
            encryptMetadata: {
                keyId: [defaultKeyId]
            },
            properties
        };
    }


    return schemaMap;
}

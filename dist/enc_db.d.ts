import { MongoClient, ClientEncryption } from 'mongodb';
import { Application } from 'express';
export declare let client: MongoClient;
export declare class EncryptedMongoClient {
    static a0: Application;
    mongoClient: MongoClient | null;
    static keyVaultNamespace: string;
    constructor(app: Application);
    init(url: string): Promise<MongoClient>;
    getClient(): MongoClient | null;
}
/**
 * Generates schema map for one or more DBs from a shared schema definition.
  * @returns MongoDB CSFLE-compliant schema map
 */
export declare function generateCSFLESchemaMapForDBs(client?: ClientEncryption): Promise<Record<string, any>>;

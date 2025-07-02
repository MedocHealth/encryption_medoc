import { MongoClient } from "mongodb";
export declare class EncryptionService {
    private static readonly KEY_VAULT_URL;
    private static readonly DB_NAME;
    private static readonly COLLECTION_NAME;
    private credential;
    private secretClient;
    private mongoClient;
    constructor(client: MongoClient);
    init(): Promise<void>;
    close(): Promise<void>;
    createKeyForUser(username: string): Promise<string>;
    encrypt(username: string, data: string): Promise<string>;
    decrypt(username: string, encryptedData: string, ivBase64: string): Promise<string>;
    getKeyFromCollection(username: string): Promise<String>;
    private fetchSymmetricKeyFromKMS;
    private storeKeyReference;
    private getKeyIdByUsername;
}

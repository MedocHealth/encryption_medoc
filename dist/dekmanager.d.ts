import { KMSProviders, MongoClient } from "mongodb";
export declare function ensureDekForField(client: MongoClient, kmsProviders: KMSProviders, fieldKeyAltName: string): Promise<String | undefined>;
export declare function createIndexesOnKeyVault(client: MongoClient): Promise<void>;
type JsonSchema = {
    [key: string]: any;
};
export declare const MONGO_URI: string;
export declare function generateCsfleSchema(kmsProviders: KMSProviders): Promise<Record<string, JsonSchema>>;
export {};

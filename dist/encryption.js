"use strict";
// EncryptionService.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionService = void 0;
const identity_1 = require("@azure/identity");
const keyvault_secrets_1 = require("@azure/keyvault-secrets");
const crypto_1 = __importDefault(require("crypto"));
const constants_1 = require("./constants/constants");
class EncryptionService {
    constructor(client) {
        this.credential = new identity_1.DefaultAzureCredential();
        this.secretClient = new keyvault_secrets_1.SecretClient(EncryptionService.KEY_VAULT_URL, this.credential);
        this.mongoClient = client;
    }
    async init() {
        await this.mongoClient.connect();
        console.log('MongoDB connected');
    }
    // Call once in app shutdown
    async close() {
        await this.mongoClient.close();
        console.log('MongoDB disconnected');
    }
    // Create and store a symmetric key in Azure Key Vault, and store its reference in MongoDB
    async createKeyForUser(username) {
        const keyId = `aes-key-${username}`;
        const keyBytes = crypto_1.default.randomBytes(32); // 256-bit key
        const base64Key = keyBytes.toString("base64");
        await this.secretClient.setSecret(keyId, base64Key);
        await this.storeKeyReference(username, keyId);
        return `${keyId}:${base64Key}`;
    }
    // Encrypt text using a user-specific AES-256-CBC key and random IV
    async encrypt(username, data) {
        const keyId = await this.getKeyIdByUsername(username);
        if (!keyId)
            throw new Error(`Key not found for user: ${username}`);
        const key = await this.fetchSymmetricKeyFromKMS(keyId);
        const iv = crypto_1.default.randomBytes(16); // 16-byte IV
        const cipher = crypto_1.default.createCipheriv("aes-256-cbc", key, iv);
        let encrypted = cipher.update(data, "utf8", "base64");
        encrypted += cipher.final("base64");
        return `${iv.toString('base64')}:${encrypted}`;
    }
    // Decrypt ciphertext using user-specific AES key and IV
    async decrypt(username, encryptedData, ivBase64) {
        const keyId = await this.getKeyIdByUsername(username);
        if (!keyId)
            throw new Error(`Key not found for user: ${username}`);
        const key = await this.fetchSymmetricKeyFromKMS(keyId);
        const iv = Buffer.from(ivBase64, "base64");
        const decipher = crypto_1.default.createDecipheriv("aes-256-cbc", key, iv);
        let decrypted = decipher.update(encryptedData, "base64", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    }
    async getKeyFromCollection(username) {
        const keyId = await this.getKeyIdByUsername(username);
        if (!keyId)
            throw new Error(`Key not found for user: ${username}`);
        const key = await this.fetchSymmetricKeyFromKMS(keyId);
        return key.toString('base64');
    }
    // Internal: Fetch a key from Azure Key Vault
    async fetchSymmetricKeyFromKMS(keyId) {
        const secret = await this.secretClient.getSecret(keyId);
        return Buffer.from(secret.value, "base64");
    }
    // Internal: Store user-keyId mapping in MongoDB
    async storeKeyReference(username, keyId) {
        await this.init();
        const db = this.mongoClient.db(EncryptionService.DB_NAME);
        const collection = db.collection(EncryptionService.COLLECTION_NAME);
        await collection.updateOne({ username }, { $set: { keyId } }, { upsert: true });
        await this.close();
    }
    // Internal: Get keyId for a username
    async getKeyIdByUsername(username) {
        await this.init();
        const db = this.mongoClient.db(EncryptionService.DB_NAME);
        const collection = db.collection(EncryptionService.COLLECTION_NAME);
        const result = await collection.findOne({ username });
        await this.close();
        return result?.keyId || null;
    }
}
exports.EncryptionService = EncryptionService;
EncryptionService.KEY_VAULT_URL = constants_1.AZURE_KEY_VAULT_ENDPOINT;
EncryptionService.DB_NAME = "UserKeys";
EncryptionService.COLLECTION_NAME = "user_key_vault";

// EncryptionService.ts

import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import { MongoClient } from "mongodb";
import crypto from "crypto";
import { AZURE_KEY_VAULT_ENDPOINT } from "./constants/constants";

export class EncryptionService {
  private static readonly KEY_VAULT_URL = AZURE_KEY_VAULT_ENDPOINT;
  private static readonly DB_NAME = "UserKeys";
  private static readonly COLLECTION_NAME = "user_key_vault";

  private credential: DefaultAzureCredential;
  private secretClient: SecretClient;
  private mongoClient: MongoClient;

  constructor(client: MongoClient) {
    
    this.credential = new DefaultAzureCredential();
    
    this.secretClient = new SecretClient(EncryptionService.KEY_VAULT_URL, this.credential);
    
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
  public async createKeyForUser(username: string): Promise<string> {
    
    const keyId = `aes-key-${username}`;
    
    const keyBytes = crypto.randomBytes(32); // 256-bit key
    const base64Key = keyBytes.toString("base64");

    await this.secretClient.setSecret(keyId, base64Key);
    await this.storeKeyReference(username, keyId);

    return `${keyId}:${base64Key}`;
  }

  // Encrypt text using a user-specific AES-256-GCM key and random IV
  public async encrypt(username: string, data: string): Promise<string> {
    
    const keyId = await this.getKeyIdByUsername(username);
    
    if (!keyId) throw new Error(`Key not found for user: ${username}`);

    const key = await this.fetchSymmetricKeyFromKMS(keyId);
    const iv = crypto.randomBytes(16); // 16-byte IV
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(data, "utf8", "base64");
    encrypted += cipher.final("base64");

    return `${iv.toString('base64')}:${encrypted}`;
  }

  // Decrypt ciphertext using user-specific AES key and IV
  public async decrypt(username: string, encryptedData: string, ivBase64: string): Promise<string> {

    const keyId = await this.getKeyIdByUsername(username);
    
    if (!keyId) throw new Error(`Key not found for user: ${username}`);

    const key = await this.fetchSymmetricKeyFromKMS(keyId);
    const iv = Buffer.from(ivBase64, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    let decrypted = decipher.update(encryptedData, "base64", "utf8");
    decrypted += decipher.final("utf8");


    return decrypted;
  }

  public async getKeyFromCollection(username: string): Promise<String> {
    
    const keyId = await this.getKeyIdByUsername(username);
    
    
    if (!keyId) throw new Error(`Key not found for user: ${username}`);

    const key = await this.fetchSymmetricKeyFromKMS(keyId);

    return key.toString('base64');

  }
  // Internal: Fetch a key from Azure Key Vault
  private async fetchSymmetricKeyFromKMS(keyId: string): Promise<Buffer> {
    
    const secret = await this.secretClient.getSecret(keyId);
    
    return Buffer.from(secret.value!, "base64");
  }

  // Internal: Store user-keyId mapping in MongoDB
  private async storeKeyReference(username: string, keyId: string): Promise<void> {
    
    await this.init();
    
    const db = this.mongoClient.db(EncryptionService.DB_NAME);
    
    const collection = db.collection(EncryptionService.COLLECTION_NAME);

    await collection.updateOne(
      { username },
      { $set: { keyId } },
      { upsert: true }
    );
    
    await this.close();

  }

  // Internal: Get keyId for a username
  private async getKeyIdByUsername(username: string): Promise<string | null> {
    
    await this.init();
    
    const db = this.mongoClient.db(EncryptionService.DB_NAME);
    
    const collection = db.collection(EncryptionService.COLLECTION_NAME);

    
    const result = await collection.findOne({ username });
    
    await this.close();
    
    return result?.keyId || null;
  }

}

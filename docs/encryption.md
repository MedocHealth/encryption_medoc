# 🗝️ encryption.ts Documentation

## 📝 Overview

This module provides the `EncryptionService` class, which manages per-user symmetric key generation, storage, encryption, and decryption using Azure Key Vault and MongoDB. It is designed to securely handle user-specific encryption keys and data, integrating with Azure and MongoDB for robust key management and data protection.

## 🏗️ Main Components

### `EncryptionService` Class

- **Purpose:**
  Handles the lifecycle of user-specific AES-256 encryption keys, including creation, storage, retrieval, encryption, and decryption of data.
  Integrates with Azure Key Vault for secure key storage and MongoDB for mapping users to their key references.

- **Constructor:**
  - Accepts a connected `MongoClient` instance.
  - Initializes Azure credentials and the Key Vault secret client.

- **Methods:**
  - `async init()`: Connects the MongoDB client.
  - `async close()`: Closes the MongoDB client connection.
  - `async createKeyForUser(username: string): Promise<string>`: Generates a new AES-256 key for a user, stores it in Azure Key Vault, and saves the key reference in MongoDB.
  - `async encrypt(username: string, data: string): Promise<string>`: Encrypts data for a user using their AES key and a random IV, returning the IV and ciphertext.
  - `async decrypt(username: string, encryptedData: string, ivBase64: string): Promise<string>`: Decrypts data for a user using their AES key and the provided IV.
  - `async getKeyFromCollection(username: string): Promise<string>`: Retrieves the user's AES key from Azure Key Vault (base64 encoded).

- **Internal Methods:**
  - `private async fetchSymmetricKeyFromKMS(keyId: string): Promise<Buffer>`: Fetches a symmetric key from Azure Key Vault.
  - `private async storeKeyReference(username: string, keyId: string): Promise<void>`: Stores the mapping of username to keyId in MongoDB.
  - `private async getKeyIdByUsername(username: string): Promise<string | null>`: Retrieves the keyId for a username from MongoDB.

## ⚙️ Configuration

- **Azure Key Vault:**
  - The module expects the Azure Key Vault endpoint to be provided via the `AZURE_KEY_VAULT_ENDPOINT` constant or environment variable.
  - Uses Azure Default Credentials for authentication.
- **MongoDB:**
  - Stores user-to-keyId mappings in the `UserKeys.user_key_vault` collection.

## 🚀 Usage Example

```typescript
import { MongoClient } from 'mongodb';
import { EncryptionService } from './encryption';

const mongoClient = new MongoClient(process.env.MONGO_URL!);
const encryptionService = new EncryptionService(mongoClient);

// Create a key for a user
await encryptionService.createKeyForUser('alice');

// Encrypt data for a user
const encrypted = await encryptionService.encrypt('alice', 'Sensitive data');
const [iv, ciphertext] = encrypted.split(':');

// Decrypt data for a user
const decrypted = await encryptionService.decrypt('alice', ciphertext, iv);
console.log(decrypted); // 'Sensitive data'
```

## 📝 Notes

- Each user gets a unique AES-256 key, stored securely in Azure Key Vault.
- The IV (initialization vector) is randomly generated for each encryption operation and must be provided for decryption.
- MongoDB is used only for mapping users to their key references, not for storing the keys themselves.
- The service requires Azure credentials to be available in the environment for authentication.

## 👤 Author

- Name: Vinayak Gupta
- Email: vinayakg236@gmail.com 
- GitHub: https://github.com/vinayakgupta29
- Site: https://vinayakgupta29.github.io/   ||   https://vinayakgupta29.github.io/portfolio
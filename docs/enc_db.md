# 🔐 enc_db.ts Documentation

## 📝 Overview

This module provides an abstraction for connecting to a MongoDB database with Client-Side Field Level Encryption (CSFLE) using Azure Key Vault as the Key Management Service (KMS). It is designed for secure storage and retrieval of sensitive data, integrating with Express applications.

## 🏗️ Main Components

### 1. `EncryptedMongoClient` Class

- **Purpose:**
  Manages the initialization and connection of a MongoDB client with automatic encryption enabled, using Azure Key Vault for key management.
- **Constructor:**
  - Accepts an Express `Application` instance.
  - Sets up the key vault namespace and stores the application reference.
- **Methods:**
  - `async init(url: string, options?: MongoClientOptions): Promise<MongoClient>`
    Initializes the MongoDB client with CSFLE, sets up KMS providers, creates or retrieves a Data Encryption Key (DEK), and configures the schema map for encryption.
  - `getClient()`
    Returns the initialized MongoDB client instance.

### 2. `generateCSFLESchemaMapForDBs` Function

- **Purpose:**
  Dynamically generates a CSFLE-compliant schema map for one or more MongoDB collections, based on a shared schema definition loaded from `conf/schema.json`.
- **Parameters:**
  - `client?: ClientEncryption` (optional)
    Used to create new data keys for encryption.
- **Returns:**
  - A schema map object suitable for use with MongoDB's auto-encryption configuration.

## ⚙️ Configuration

- **Azure KMS:**
  The module expects Azure credentials and key vault details to be provided via environment variables or constants.
- **Schema Definition:**
  The encryption schema for collections is defined in a JSON file at `conf/schema.json`.

## 🚀 Usage Example

```typescript
import express from 'express';
import { EncryptedMongoClient } from './enc_db';

const app = express();
const encClient = new EncryptedMongoClient(app);

encClient.init(process.env.MONGO_URL)
  .then(client => {
    // Use the encrypted client for DB operations
  })
  .catch(err => {
    console.error('Failed to initialize encrypted MongoDB client:', err);
  });
```

## 📝 Notes

- The module is tightly coupled with Azure Key Vault and expects specific environment variables to be set.
- The schema map generation function reads from a shared schema file and can create new data keys if a `ClientEncryption` instance is provided.
- The code is designed for integration with Express-based applications.

## 👤 Author

- Name: Vinayak Gupta
- Email: vinayakg236@gmail.com 
- GitHub: https://github.com/vinayakgupta29
- Site: https://vinayakgupta29.github.io/   ||   https://vinayakgupta29.github.io/portfolio
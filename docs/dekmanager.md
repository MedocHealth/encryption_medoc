# 🔑 dekmanager.ts Documentation

📑🔙[Back to Index](./index.md)

## 📝 Overview

This module provides utilities for managing Data Encryption Keys (DEKs) and generating Client-Side Field Level Encryption (CSFLE) schema maps for MongoDB collections, using Azure Key Vault as the KMS provider. It automates DEK creation, schema generation, and key vault index management to support secure field-level encryption in the Medoc application.

## 🏗️ Main Components

### 🛠️ Functions

- **`ensureDekForField(client, kmsProviders, fieldKeyAltName)`**
  - Ensures a Data Encryption Key (DEK) exists for a specific field (by alternate name). If not, creates a new DEK in Azure Key Vault and returns its ID (base64 encoded).
  - Parameters:
    - `client`: MongoDB client instance
    - `kmsProviders`: KMS provider configuration (Azure)
    - `fieldKeyAltName`: Alternate name for the field's DEK
  - Returns: DEK ID as a base64 string

- **`createIndexesOnKeyVault(client)`**
  - Creates necessary indexes on the key vault collection to ensure uniqueness and performance for key lookups.
  - Parameters:
    - `client`: MongoDB client instance

- **`generateCsfleSchema(kmsProviders)`**
  - Generates a CSFLE-compliant schema map for all collections and fields defined in the schema JSON file. Ensures each field has a DEK and attaches encryption metadata to the schema.
  - Parameters:
    - `kmsProviders`: KMS provider configuration (Azure)
  - Returns: Schema map object for MongoDB auto-encryption

## ⚙️ Configuration

- **Azure Key Vault:**
  - Requires Azure Key Vault endpoint and key name, provided via constants or environment variables.
- **Schema Definition:**
  - Reads collection and field definitions from `conf/schema.json`.
- **MongoDB:**
  - Uses a key vault collection for storing DEKs and their metadata.

## 🚀 Usage Example

```typescript
import { MongoClient } from 'mongodb';
import { generateCsfleSchema, ensureDekForField } from './dekmanager';

const kmsProviders = { /* Azure KMS config */ };
const client = new MongoClient(process.env.MONGO_URL!);

// Ensure a DEK exists for a field
await ensureDekForField(client, kmsProviders, 'Users.ssn');

// Generate a CSFLE schema map
const schemaMap = await generateCsfleSchema(kmsProviders);
```

## 📝 Notes

- This module automates DEK management and schema generation for field-level encryption.
- It is designed to work with Azure Key Vault as the KMS provider.
- The schema JSON file should be kept up to date with the application's data model.

## 👤 Author

- Name: Vinayak Gupta
- Email: <vinayakg236@gmail.com>
- GitHub: <https://github.com/vinayakgupta29>
- Site: <https://vinayakgupta29.github.io/>   ||   <https://vinayakgupta29.github.io/portfolio>

# 🛡️ Medoc Encryption Module Documentation

Welcome to the documentation for the Medoc Encryption Module. This documentation provides detailed information about the core modules that enable secure data storage, encryption, and management within the Medoc application. Each section covers a specific aspect of the system, including database encryption, per-user key management, collection organization, and developer utilities.

## 📚 Documentation Index

- [🔐 Encrypted Database Integration (`enc_db.ts`)](./enc_db.md)
  - Learn how the application integrates MongoDB with Client-Side Field Level Encryption (CSFLE) using Azure Key Vault for secure data storage.

- [🗝️ User Encryption Service (`encryption.ts`)](./encryption.md)
  - Discover how per-user symmetric keys are generated, stored, and used for encrypting and decrypting sensitive data with Azure Key Vault and MongoDB.

- [🔑 DEK Management & Schema Generation (`dekmanager.ts`)](./dekmanager.md)
  - Understand how Data Encryption Keys (DEKs) are managed and how CSFLE schema maps are generated for secure field-level encryption.

- [📂 Collection Names Enum (`collections.ts`)](./collections.md)
  - Reference the centralized enum for all MongoDB collection names used in the Medoc application, ensuring consistency and reducing errors.

- [🛠️ Utility Functions (`utils.ts`)](./utils.md)
  - Platform detection and other helper utilities for scripts and services that require OS-specific logic.

- [⚙️ Platform Setup Script (`prepare.js`)](./prepare.md)
  - Automates the installation of mongocryptd and MongoDB Enterprise components for CSFLE support across Ubuntu, macOS, and Windows.

- [🚧 Development Utilities (`devtrials.ts`)](./devtrials.md)
  - **⚠️ For development use only!** Provides debugging, database snapshot, and admin routes. Must be pruned from production for security reasons.

---

For more details on each module, click the links above. This documentation is intended to help developers understand, maintain, and extend the encryption and data management features of the Medoc platform.

## 👤 Author

- Name: Vinayak Gupta
- Email: <vinayakg236@gmail.com>
- GitHub: <https://github.com/vinayakgupta29>
- Site: <https://vinayakgupta29.github.io/>   ||   <https://vinayakgupta29.github.io/portfolio>

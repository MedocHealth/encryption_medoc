# 📂 collections.ts Documentation

## 📝 Overview

This module defines the `MedocCollections` enum, which provides a centralized and type-safe way to reference the names of MongoDB collections used in the Medoc application. Using an enum for collection names helps prevent typos and ensures consistency throughout the codebase.

## 🏗️ Main Components

### 📋 `MedocCollections` Enum

- **Purpose:**
  - Enumerates all MongoDB collection names used in the application as string constants.
  - Facilitates maintainable and error-resistant code by avoiding hardcoded collection name strings.

- **Values:**
  - `ALERTS` = "Alerts"
  - `CHATS` = "Chats"
  - `DEFAULTFORMS` = "defaultForms"
  - `DOCTORLIST` = "DoctorList"
  - `EMERGENCY` = "Emergency"
  - `EMPLOYEE` = "Employee"
  - `EXPENSES` = "Expenses"
  - `FINANCE` = "Finance"
  - `HOSPITALS` = "Hospitals"
  - `INVOICES` = "Invoices"
  - `IPDBILLS` = "IpdBills"
  - `IPDLIST` = "IPDList"
  - `ITEM` = "Item"
  - `PATIENTLIST` = "PatientList"
  - `SURGERIES` = "Surgeries"
  - `TASKLIST` = "TaskList"
  - `USERS` = "Users"

## 🚀 Usage Example

```typescript
import { MedocCollections } from './collections';

// Example: Accessing a collection in MongoDB
const collection = db.collection(MedocCollections.USERS);
```

## 📝 Notes

- Update this enum whenever a new collection is added to or removed from the database schema.
- Using enums for collection names helps prevent bugs caused by typos in string literals.

## 👤 Author

- Name: Vinayak Gupta
- Email: vinayakg236@gmail.com 
- GitHub: https://github.com/vinayakgupta29
- Site: https://vinayakgupta29.github.io/   ||   https://vinayakgupta29.github.io/portfolio
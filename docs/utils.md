# 🛠️ utils.ts Document.ation

📑🔙[Back to Index](./index.md)

## 📝 Overview

This utility module provides helper functions for platform detection, specifically to determine if the current operating system is Ubuntu Linux. It is a lightweight utility that can be used in scripts or services that require OS-specific logic.

## 🏗️ Main Components

### 🧩 Functions

- **`isUbuntu()`**
  - Checks if the current operating system is Ubuntu Linux.
  - Returns: `true` if running on Ubuntu, otherwise `false`.
  - Implementation:
    - Checks if the platform is Linux.
    - Reads `/etc/ls-release` and looks for the string "ubuntu" (case-insensitive).
    - Returns `false` if the file cannot be read or if the OS is not Ubuntu.

## 🚀 Usage Example

```typescript
import { isUbuntu } from './utils';

if (isUbuntu()) {
  console.log('Running on Ubuntu!');
} else {
  console.log('Not running on Ubuntu.');
}
```

## 📝 Notes

- This utility is intended for use in environments where platform-specific behavior is required.
- The function will return `false` on non-Linux systems or if the `/etc/ls-release` file is missing.

## 👤 Author

- Name: Vinayak Gupta
- Email: <vinayakg236@gmail.com>
- GitHub: <https://github.com/vinayakgupta29>
- Site: <https://vinayakgupta29.github.io/>   ||   <https://vinayakgupta29.github.io/portfolio>

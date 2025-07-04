# ⚙️ prepare.js Documentation

📑🔙[Back to Index](./index.md)

## 📝 Overview

This script automates the installation of the `mongocryptd` process required for MongoDB Client-Side Field Level Encryption (CSFLE) across different operating systems (Ubuntu, macOS, Windows). It detects the current platform, installs the necessary MongoDB Enterprise components, and verifies the installation, streamlining the setup process for developers.

## 🏗️ Main Components

### 🖥️ Platform Detection

- Detects the current OS (Ubuntu, macOS, Windows) using Node.js `os` and `fs` modules.
- Uses a helper function to check for Ubuntu specifically.

### 📦 Installation Functions

- **`installUbuntu()`**: Installs `mongodb-enterprise` and `mongodb-enterprise-cryptd` using APT repositories and GPG keys for Ubuntu/Debian systems.
- **`installMac()`**: Installs `mongodb-enterprise` using Homebrew for macOS.
- **`installWindows()`**: Installs `mongodb-enterprise` using Chocolatey for Windows.

### 🛠️ Utility Functions

- **`run(command)`**: Executes shell commands and handles errors.
- **`checkExists(cmd)`**: Checks if a command exists in the system's PATH.
- **`getUbuntuCodename()`**: Reads the Ubuntu codename from `/etc/lsb-release`.
- **`verifyInstallation()`**: Verifies that `mongocryptd` is installed and available in the PATH.

### 🧩 Main Logic

- Detects the platform and calls the appropriate installation function.
- Verifies the installation of `mongocryptd`.
- Exits with an error message if the OS is unsupported or if installation fails.

## 🚀 Usage Example

```sh
node prepare.js
```

- Run this script from your project root to automatically install the required MongoDB Enterprise components for your platform.

## 📝 Notes

- Requires administrative privileges (sudo on Linux/macOS, admin on Windows) to install system packages.
- Homebrew (macOS) and Chocolatey (Windows) must be installed prior to running the script on their respective platforms.
- The script is intended to be run as a setup step before using CSFLE features in your application.

## 👤 Author

- Name: Vinayak Gupta
- Email: <vinayakg236@gmail.com>
- GitHub: <https://github.com/vinayakgupta29>
- Site: <https://vinayakgupta29.github.io/>   ||   <https://vinayakgupta29.github.io/portfolio>

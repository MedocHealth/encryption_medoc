#!/usr/bin/env node

const { execSync } = require("child_process");
const os = require("os");
const fs = require("fs");

const platform = os.platform();
console.log(`🔍 Detected platform: ${platform}`);

function run(command) {
  try {
    console.log(`➡️  Running: ${command}`);
    const output = execSync(command, { stdio: "inherit" });
    return output;
  } catch (err) {
    console.error(`❌ Command failed: ${command}`);
    console.error(err.message);
    process.exit(1);
  }
}

function checkExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function installLinux() {
  console.log("📦 Installing mongocryptd on Linux (Ubuntu/Debian)");

  const codename = execSync("lsb_release -c -s").toString().trim();

  run("wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -");

  run(
    `echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu ${codename}/mongodb-enterprise/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-enterprise.list`
  );

  run("sudo apt update");
  run("sudo apt install -y mongodb-enterprise mongodb-enterprise-cryptd");
}

function installMac() {
  console.log("📦 Installing mongocryptd on macOS via Homebrew");

  if (!checkExists("brew")) {
    console.error("❌ Homebrew is not installed. Please install it first: https://brew.sh/");
    process.exit(1);
  }

  run("brew tap mongodb/brew");
  run("brew install mongodb-enterprise");
}

function installWindows() {
  console.log("📦 Installing mongocryptd on Windows via Chocolatey");

  if (!checkExists("choco")) {
    console.error("❌ Chocolatey not found. Please install Chocolatey first: https://chocolatey.org/install");
    process.exit(1);
  }

  run("choco install mongodb-enterprise --version=7.0.0 --yes");
}

function verifyInstallation() {
  try {
    execSync("mongocryptd --version", { stdio: "inherit" });
    console.log("✅ mongocryptd is successfully installed and available!");
  } catch {
    console.error("❌ mongocryptd not found in PATH after installation.");
    process.exit(1);
  }
}

// Main logic
(async () => {
  switch (platform) {
    case "linux":
      installLinux();
      break;
    case "darwin":
      installMac();
      break;
    case "win32":
      installWindows();
      break;
    default:
      console.error(`❌ Unsupported OS: ${platform}`);
      process.exit(1);
  }

  verifyInstallation();
})();

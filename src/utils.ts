import * as os from 'os';
import * as fs from 'fs';

export function isUbuntu(): boolean {
    if (os.platform() !== "linux") return false;

    try {
        const osRelease = fs.readFileSync("/etc/ls-release", "utf-8");
        return osRelease.toLowerCase().includes("ubuntu");
    } catch (e) {
        return false;
    }
}
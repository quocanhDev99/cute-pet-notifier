/**
 * Secret Store — tokens are encrypted with the OS credential facility via
 * Electron `safeStorage` (macOS Keychain / Windows DPAPI). Secrets are never
 * returned to the UI; only "isSet" flags are exposed.
 */
const fs = require('fs');
const path = require('path');

class SecretStore {
  /** @param {string} dir  @param {{isEncryptionAvailable():boolean, encryptString(s):Buffer, decryptString(b):string}} safeStorage */
  constructor(dir, safeStorage) {
    this.file = path.join(dir, 'secrets.bin.json');
    this.safeStorage = safeStorage;
    this.cache = {};
    try {
      if (fs.existsSync(this.file)) this.cache = JSON.parse(fs.readFileSync(this.file, 'utf8')) || {};
    } catch { this.cache = {}; }
  }

  available() {
    try { return !!(this.safeStorage && this.safeStorage.isEncryptionAvailable()); } catch { return false; }
  }

  set(key, value) {
    if (!value) { delete this.cache[key]; this.persist(); return true; }
    if (!this.available()) throw new Error('Bộ lưu trữ bảo mật của hệ điều hành không khả dụng');
    this.cache[key] = this.safeStorage.encryptString(String(value)).toString('base64');
    this.persist();
    return true;
  }

  get(key) {
    const enc = this.cache[key];
    if (!enc || !this.available()) return null;
    try { return this.safeStorage.decryptString(Buffer.from(enc, 'base64')); } catch { return null; }
  }

  has(key) { return !!this.cache[key]; }

  persist() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.cache), { mode: 0o600 });
  }
}

module.exports = { SecretStore };

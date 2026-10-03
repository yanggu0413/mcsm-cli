import fs from 'fs';
import path from 'path';
import os from 'os';
import childProcess from 'child_process';

export interface CLIStoredConfig {
  url?: string;
  apiKey?: string;
}

const CONFIG_PATH = path.join(os.homedir(), '.mcsmrc.json');

export function loadStoredConfig(): CLIStoredConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // Ignore corrupt or unreadable config file
  }
  return {};
}

export function maskApiKey(apiKey?: string | null): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 8) return '********';
  return `${apiKey.slice(0, 3)}...${apiKey.slice(-3)}`;
}

function secureWindowsConfigFile(): void {
  const username = process.env.USERNAME || os.userInfo().username;
  const principal = process.env.USERDOMAIN
    ? `${process.env.USERDOMAIN}\\${username}`
    : username;

  if (!principal) {
    throw new Error('Unable to determine the current Windows user for config ACL');
  }

  childProcess.execFileSync(
    'icacls.exe',
    [CONFIG_PATH, '/reset', '/inheritance:r', '/grant:r', `${principal}:(F)`],
    { stdio: 'ignore' }
  );
}

export function saveStoredConfig(newConfig: CLIStoredConfig): void {
  const existing = loadStoredConfig();
  const merged = { ...existing, ...newConfig };
  const serialized = JSON.stringify(merged, null, 2);

  if (process.platform === 'win32') {
    fs.writeFileSync(CONFIG_PATH, '', { encoding: 'utf-8', flag: 'a' });
    secureWindowsConfigFile();
    fs.writeFileSync(CONFIG_PATH, serialized, 'utf-8');
    return;
  }

  fs.writeFileSync(CONFIG_PATH, serialized, {
    encoding: 'utf-8',
    mode: 0o600,
  });
  fs.chmodSync(CONFIG_PATH, 0o600);
}

export function getStoredConfigPath(): string {
  return CONFIG_PATH;
}

export function resolveClientConfig(cmdOptions: { url?: string; key?: string } = {}) {
  const stored = loadStoredConfig();

  const baseUrl =
    cmdOptions.url ||
    process.env.MCSM_BASE_URL ||
    stored.url ||
    'http://localhost:23333';

  const apiKey =
    cmdOptions.key ||
    process.env.MCSM_API_KEY ||
    stored.apiKey ||
    '';

  return { baseUrl, apiKey };
}

import fs from 'fs';
import path from 'path';
import os from 'os';

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

export function saveStoredConfig(newConfig: CLIStoredConfig): void {
  const existing = loadStoredConfig();
  const merged = { ...existing, ...newConfig };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
  try {
    fs.chmodSync(CONFIG_PATH, 0o600);
  } catch {
    // chmod may not be fully supported on some Windows filesystems
  }
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

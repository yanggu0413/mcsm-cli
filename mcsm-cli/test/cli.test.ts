import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import childProcess from 'child_process';
import {
  resolveClientConfig,
  saveStoredConfig,
  loadStoredConfig,
  maskApiKey,
} from '../src/config.js';
import {
  validateSafePath,
  validateNoNewlines,
  checkSafeDownloadUrl,
  isBinaryPath,
  desensitizeUserInfo,
  clampPageSize,
  getClient,
} from '../src/index.js';

vi.mock('fs');

describe('CLI Configuration Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves defaults when no stored config or env vars exist', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    delete process.env.MCSM_BASE_URL;
    delete process.env.MCSM_API_KEY;

    const resolved = resolveClientConfig();
    expect(resolved.baseUrl).toBe('http://localhost:23333');
    expect(resolved.apiKey).toBe('');
  });

  it('prefers CLI flags over environment variables and stored config', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ url: 'http://stored:23333', apiKey: 'stored-key' })
    );
    process.env.MCSM_BASE_URL = 'http://env:23333';
    process.env.MCSM_API_KEY = 'env-key';

    const resolved = resolveClientConfig({
      url: 'http://cli:23333',
      key: 'cli-key',
    });

    expect(resolved.baseUrl).toBe('http://cli:23333');
    expect(resolved.apiKey).toBe('cli-key');
  });

  it('uses environment variables when CLI flags are absent', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ url: 'http://stored:23333', apiKey: 'stored-key' })
    );
    process.env.MCSM_BASE_URL = 'http://env:23333';
    process.env.MCSM_API_KEY = 'env-key';

    const resolved = resolveClientConfig({});
    expect(resolved.baseUrl).toBe('http://env:23333');
    expect(resolved.apiKey).toBe('env-key');
  });

  it('merges and writes stored config with platform-specific private permissions', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ url: 'http://localhost:23333', apiKey: 'old-key' })
    );
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    const chmodSpy = vi.spyOn(fs, 'chmodSync').mockImplementation(() => {});
    const aclSpy = vi
      .spyOn(childProcess, 'execFileSync')
      .mockReturnValue(Buffer.from(''));

    saveStoredConfig({ apiKey: 'new-key' });

    const configPath = expect.stringContaining('.mcsmrc.json');
    if (process.platform === 'win32') {
      const username = process.env.USERNAME || os.userInfo().username;
      const principal = process.env.USERDOMAIN
        ? `${process.env.USERDOMAIN}\\${username}`
        : username;

      expect(writeSpy).toHaveBeenNthCalledWith(
        1,
        configPath,
        '',
        { encoding: 'utf-8', flag: 'a' }
      );
      expect(aclSpy).toHaveBeenCalledWith(
        'icacls.exe',
        [configPath, '/reset', '/inheritance:r', '/grant:r', `${principal}:(F)`],
        { stdio: 'ignore' }
      );
      expect(writeSpy).toHaveBeenNthCalledWith(
        2,
        configPath,
        expect.stringContaining('"apiKey": "new-key"'),
        'utf-8'
      );
      expect(chmodSpy).not.toHaveBeenCalled();
    } else {
      expect(writeSpy).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('"apiKey": "new-key"'),
        expect.objectContaining({ encoding: 'utf-8', mode: 0o600 })
      );
      expect(chmodSpy).toHaveBeenCalledWith(configPath, 0o600);
      expect(aclSpy).not.toHaveBeenCalled();
    }
  });

  it('masks sensitive API keys securely without leaking short keys', () => {
    expect(maskApiKey(null)).toBeNull();
    expect(maskApiKey('')).toBeNull();
    expect(maskApiKey('1234')).toBe('********');
    expect(maskApiKey('12345678')).toBe('********');
    expect(maskApiKey('1234567890abcdef')).toBe('123...def');
  });
});

describe('CLI Security and Validation Helpers', () => {
  it('validates safe paths and rejects path traversal', () => {
    expect(validateSafePath('server.properties')).toBe('/server.properties');
    expect(validateSafePath('/logs/latest.log')).toBe('/logs/latest.log');
    expect(validateSafePath('./plugins/WorldEdit.jar')).toBe('/plugins/WorldEdit.jar');

    expect(() => validateSafePath('../escaped.txt')).toThrow('directory traversal');
    expect(() => validateSafePath('/plugins/../../etc/passwd')).toThrow('directory traversal');
    expect(() => validateSafePath('', false)).toThrow();
    expect(() => validateSafePath('/', false)).toThrow('Operation on root directory "/" is forbidden');
  });

  it('detects newline characters to prevent command injection', () => {
    expect(() => validateNoNewlines('say hello world')).not.toThrow();
    expect(() => validateNoNewlines('say hello\nstop')).toThrow('newline characters');
    expect(() => validateNoNewlines('say hello\rstop')).toThrow('newline characters');
  });

  it('detects and blocks SSRF download URLs', () => {
    expect(() => checkSafeDownloadUrl('https://example.com/mod.jar')).not.toThrow();
    expect(() => checkSafeDownloadUrl('http://169.254.169.254/latest/meta-data')).toThrow('SSRF Protection');
    expect(() => checkSafeDownloadUrl('http://localhost:8080/secret')).toThrow('SSRF Protection');
    expect(() => checkSafeDownloadUrl('http://127.0.0.1/hack')).toThrow('SSRF Protection');
    expect(() => checkSafeDownloadUrl('http://192.168.1.1/admin')).toThrow('SSRF Protection');
    expect(() => checkSafeDownloadUrl('ftp://example.com/mod.jar')).toThrow('Unsupported URL protocol');
  });

  it('detects binary file extensions', () => {
    expect(isBinaryPath('/server.jar')).toBe(true);
    expect(isBinaryPath('/world.zip')).toBe(true);
    expect(isBinaryPath('/server.properties')).toBe(false);
    expect(isBinaryPath('/logs/latest.log')).toBe(false);
  });

  it('desensitizes sensitive user profile fields', () => {
    const raw = {
      userName: 'admin',
      apiKey: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
      secret: '2FA_TOTP_SECRET_123',
      passWord: 'supersecretpassword',
      salt: 'somesalt',
      permission: 10,
    };
    const sanitized = desensitizeUserInfo(raw);
    expect(sanitized.secret).toBe('[REDACTED]');
    expect(sanitized.apiKey).toBe('a1b...5p6');
    expect(sanitized.passWord).toBe('');
    expect(sanitized.salt).toBe('');
    expect(sanitized.permission).toBe(10);
  });

  it('clamps pagination parameters within 1 ~ 50 range', () => {
    expect(clampPageSize(undefined, 20, 50)).toBe(20);
    expect(clampPageSize('invalid', 20, 50)).toBe(20);
    expect(clampPageSize(0, 20, 50)).toBe(20);
    expect(clampPageSize(10, 20, 50)).toBe(10);
    expect(clampPageSize(100, 20, 50)).toBe(50);
  });

  it('exits immediately when API key is missing to prevent double error', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('PROCESS_EXIT_CALLED');
    }) as any);
    delete process.env.MCSM_API_KEY;
    delete process.env.MCSM_BASE_URL;
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    expect(() => getClient({ json: true })).toThrow('PROCESS_EXIT_CALLED');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

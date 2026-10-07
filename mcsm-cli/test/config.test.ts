import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import childProcess from 'child_process';
import {
  resolveClientConfig,
  saveStoredConfig,
  loadStoredConfig,
  maskApiKey,
} from '../src/config.js';

vi.mock('fs');

describe('CLI Configuration Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('resolves defaults when no stored config or env vars exist', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.stubEnv('MCSM_BASE_URL', '');
    vi.stubEnv('MCSM_API_KEY', '');

    const resolved = resolveClientConfig();
    expect(resolved.baseUrl).toBe('http://localhost:23333');
    expect(resolved.apiKey).toBe('');
  });

  it('prefers CLI flags over environment variables and stored config', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ url: 'http://stored:23333', apiKey: 'stored-key' })
    );
    vi.stubEnv('MCSM_BASE_URL', 'http://env:23333');
    vi.stubEnv('MCSM_API_KEY', 'env-key');

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
    vi.stubEnv('MCSM_BASE_URL', 'http://env:23333');
    vi.stubEnv('MCSM_API_KEY', 'env-key');

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
      expect(aclSpy).toHaveBeenNthCalledWith(
        1,
        'icacls.exe',
        [configPath, '/reset'],
        { stdio: 'ignore' }
      );
      expect(aclSpy).toHaveBeenNthCalledWith(
        2,
        'icacls.exe',
        [configPath, '/inheritance:r', '/grant:r', `${principal}:(F)`],
        { stdio: 'ignore' }
      );
      expect(aclSpy).toHaveBeenCalledTimes(2);
      expect(writeSpy.mock.invocationCallOrder[0]).toBeLessThan(aclSpy.mock.invocationCallOrder[0]);
      expect(aclSpy.mock.invocationCallOrder[1]).toBeLessThan(writeSpy.mock.invocationCallOrder[1]);
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

  it.runIf(process.platform === 'win32').each([1, 2])('does not overwrite credentials when ACL operation %i fails', (failureStep) => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ apiKey: 'old-key' }));
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    let aclCalls = 0;
    const aclSpy = vi.spyOn(childProcess, 'execFileSync').mockImplementation(() => {
      aclCalls += 1;
      if (aclCalls === failureStep) throw new Error('ACL operation failed');
      return Buffer.from('');
    });

    expect(() => saveStoredConfig({ apiKey: 'new-key' })).toThrow('ACL operation failed');
    expect(aclSpy).toHaveBeenCalledTimes(failureStep);
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('.mcsmrc.json'), '', { encoding: 'utf-8', flag: 'a' });
  });

  it('masks sensitive API keys securely without leaking short keys', () => {
    expect(maskApiKey(null)).toBeNull();
    expect(maskApiKey('')).toBeNull();
    expect(maskApiKey('1234')).toBe('********');
    expect(maskApiKey('12345678')).toBe('********');
    expect(maskApiKey('1234567890abcdef')).toBe('123...def');
  });
});

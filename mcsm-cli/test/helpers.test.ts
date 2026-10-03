import { describe, it, expect } from 'vitest';
import { validateSafePath, isBinaryPath } from '../src/utils/paths.js';
import { validateNoNewlines, checkSafeDownloadUrl } from '../src/utils/validation.js';
import { desensitizeUserInfo } from '../src/utils/redaction.js';
import { clampPageSize } from '../src/utils/pagination.js';

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

});

import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const cliEntry = path.join(packageRoot, 'src', 'index.ts');
const testHomes: string[] = [];

function runCli(testHome: string, args: string[]) {
  // Confirm os.homedir resolves to the disposable home before any credential write.
  const environment = { ...process.env, USERPROFILE: testHome, MCSM_BASE_URL: '', MCSM_API_KEY: '' };
  const home = spawnSync(process.execPath, ['--input-type=module', '-e', 'import os from "node:os"; console.log(os.homedir())'], {
    cwd: packageRoot, env: environment, encoding: 'utf8', timeout: 10000,
  });
  if (home.error) throw home.error;
  expect(home.status).toBe(0);
  expect(home.stdout.trim()).toBe(testHome);
  const result = spawnSync(process.execPath, ['--import', 'tsx', cliEntry, ...args], {
    cwd: packageRoot, env: environment, encoding: 'utf8', timeout: 15000,
  });
  if (result.error) throw result.error;
  return result;
}

function createTestHome() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mcsm-config-acl-test-'));
  testHomes.push(directory);
  return directory;
}

function inspectAcl(configPath: string) {
  const aclEnvironment: NodeJS.ProcessEnv = { ...process.env, MCSM_ACL_TEST_FILE: configPath };
  // Windows PowerShell must discover its own modules, not inherit a pwsh 7 module path.
  for (const name of Object.keys(aclEnvironment)) {
    if (name.toLowerCase() === 'psmodulepath') delete aclEnvironment[name];
  }
  // Supply the path through the environment so it cannot become PowerShell code.
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `
    $ErrorActionPreference = 'Stop';
    $acl = Get-Acl -LiteralPath $env:MCSM_ACL_TEST_FILE;
    [pscustomobject]@{
      CurrentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value;
      Protected = $acl.AreAccessRulesProtected;
      Rules = @($acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | ForEach-Object {
        [pscustomobject]@{ Sid = $_.IdentityReference.Value; Rights = [string]$_.FileSystemRights; Type = [string]$_.AccessControlType; Inherited = $_.IsInherited }
      })
    } | ConvertTo-Json -Depth 5 -Compress
  `], {
    env: aclEnvironment, encoding: 'utf8', timeout: 10000,
  });
  if (result.error) throw result.error;
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as {
    CurrentSid: string;
    Protected: boolean;
    Rules: { Sid: string; Rights: string; Type: string; Inherited: boolean }[];
  };
}

function expectPrivateAcl(configPath: string) {
  const acl = inspectAcl(configPath);
  expect(acl.Protected).toBe(true);
  expect(acl.Rules).toEqual([{ Sid: acl.CurrentSid, Rights: 'FullControl', Type: 'Allow', Inherited: false }]);
}

afterEach(() => {
  for (const directory of testHomes.splice(0)) {
    const resolvedDirectory = path.resolve(directory);
    if (path.dirname(resolvedDirectory) !== path.resolve(os.tmpdir()) || !path.basename(resolvedDirectory).startsWith('mcsm-config-acl-test-')) {
      throw new Error('Unexpected ACL test cleanup target');
    }
    fs.rmSync(resolvedDirectory, { recursive: true, force: true });
  }
});

describe.skipIf(process.platform !== 'win32')('Windows credential ACL integration', () => {
  it('creates, reads and updates credentials using real icacls with current-user-only access', () => {
    const testHome = createTestHome();
    const configPath = path.join(testHome, '.mcsmrc.json');
    const first = runCli(testHome, ['config', 'set', '--url', 'http://acl-test.invalid', '--key', 'fake-test-key', '--json']);
    expect(first.status, first.stderr).toBe(0);
    expect(first.stderr).toBe('');
    expect(JSON.parse(first.stdout).success).toBe(true);
    expect(JSON.parse(fs.readFileSync(configPath, 'utf8'))).toEqual({ url: 'http://acl-test.invalid', apiKey: 'fake-test-key' });
    expectPrivateAcl(configPath);

    const update = runCli(testHome, ['config', 'set', '--key', 'updated-test-key', '--json']);
    expect(update.status, update.stderr).toBe(0);
    expect(JSON.parse(fs.readFileSync(configPath, 'utf8'))).toEqual({ url: 'http://acl-test.invalid', apiKey: 'updated-test-key' });
    expectPrivateAcl(configPath);

    const read = runCli(testHome, ['config', 'get', '--json']);
    expect(read.status, read.stderr).toBe(0);
    expect(JSON.parse(read.stdout).saved).toEqual({ url: 'http://acl-test.invalid', apiKey: 'upd...key' });
  }, 30000);

  it('removes an existing explicit Everyone grant while preserving stored settings', () => {
    const testHome = createTestHome();
    const configPath = path.join(testHome, '.mcsmrc.json');
    fs.writeFileSync(configPath, JSON.stringify({ url: 'http://acl-test.invalid', apiKey: 'old-test-key' }));
    const broaden = spawnSync('icacls.exe', [configPath, '/grant', '*S-1-1-0:(R)'], { encoding: 'utf8', timeout: 10000 });
    if (broaden.error) throw broaden.error;
    expect(broaden.status, broaden.stderr).toBe(0);
    const seededAcl = inspectAcl(configPath);
    expect(seededAcl.Rules.some(rule => rule.Sid === 'S-1-1-0'), JSON.stringify(seededAcl)).toBe(true);

    const update = runCli(testHome, ['config', 'set', '--key', 'updated-test-key', '--json']);
    expect(update.status, update.stderr).toBe(0);
    expect(JSON.parse(fs.readFileSync(configPath, 'utf8'))).toEqual({ url: 'http://acl-test.invalid', apiKey: 'updated-test-key' });
    expectPrivateAcl(configPath);
  }, 30000);
});

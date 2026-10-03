#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import {
  resolveClientConfig,
  saveStoredConfig,
  loadStoredConfig,
  getStoredConfigPath,
  maskApiKey,
} from './config.js';
import { printOutput, printError } from './output.js';
import { MCSMClient } from './client/mcsmClient.js';

const program = new Command();

program
  .name('mcsm')
  .description('MCSManager CLI & AI Agent toolsuite')
  .version('1.0.0')
  .option('-u, --url <url>', 'MCSManager panel URL (e.g. http://localhost:23333)')
  .option('-k, --key <key>', 'MCSManager API Key')
  .option('-j, --json', 'Output raw JSON for script/agent parsing', false);

// -------------------------------------------------------------
// Helper Functions: Security & Formatting
// -------------------------------------------------------------

export function validateSafePath(target: string, allowRoot: boolean = true): string {
  if (!target || typeof target !== 'string') {
    throw new Error('Path must be a non-empty string');
  }
  const clean = target.replace(/\\/g, '/');
  // Disallow any ".." directory traversal segment
  const segments = clean.split('/');
  if (segments.includes('..')) {
    throw new Error(`Invalid path: "${target}" contains directory traversal`);
  }
  const normalized = path.posix.normalize(clean);
  if (!allowRoot && (normalized === '/' || normalized === '.' || normalized === '')) {
    throw new Error('Operation on root directory "/" is forbidden for safety');
  }
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export function validateNoNewlines(command: string): void {
  if (/[\r\n]/.test(command)) {
    throw new Error('Command contains newline characters (potential command injection vulnerability)');
  }
}

export function checkSafeDownloadUrl(urlStr: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error(`Invalid URL: "${urlStr}"`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported URL protocol: "${parsed.protocol}". Only HTTP and HTTPS are permitted.`);
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname === '169.254.169.254' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.internal') ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    /^192\.168\./.test(hostname)
  ) {
    throw new Error(`SSRF Protection: Access to private/internal network address "${hostname}" is forbidden.`);
  }
}

const BINARY_EXTENSIONS = new Set([
  '.jar', '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.exe', '.bin', '.iso', '.dat', '.db', '.png', '.jpg',
  '.jpeg', '.gif', '.mp4', '.ogg', '.wav', '.mp3',
]);

export function isBinaryPath(target: string): boolean {
  const ext = path.posix.extname(target).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

export function desensitizeUserInfo(user: any): any {
  if (!user || typeof user !== 'object') return user;
  const sanitized = { ...user };
  if ('secret' in sanitized) {
    sanitized.secret = '[REDACTED]';
  }
  if ('apiKey' in sanitized && sanitized.apiKey) {
    sanitized.apiKey = maskApiKey(sanitized.apiKey);
  }
  if ('passWord' in sanitized) {
    sanitized.passWord = '';
  }
  if ('salt' in sanitized) {
    sanitized.salt = '';
  }
  return sanitized;
}

export function clampPageSize(val: any, defaultSize: number = 20, max: number = 50): number {
  const n = Number(val);
  if (isNaN(n) || n < 1) return defaultSize;
  return Math.min(n, max);
}

export async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let content = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => {
      content += chunk;
    });
    process.stdin.on('end', () => {
      resolve(content);
    });
    process.stdin.on('error', (err) => {
      reject(err);
    });
  });
}

// -------------------------------------------------------------
// Commander Output & Error Override for --json
// -------------------------------------------------------------

program.exitOverride();
program.configureOutput({
  writeErr: (str) => {
    const isJson = process.argv.includes('-j') || process.argv.includes('--json');
    if (isJson) {
      const clean = str.replace(/^error:\s*/i, '').trim();
      if (clean) {
        printError(new Error(clean), true);
      }
    } else {
      process.stderr.write(str);
    }
  },
});

function getClient(cmdOpts: any = {}): { mcsm: MCSMClient; isJson: boolean } {
  const globalOpts = program.opts();
  const isJson = Boolean(cmdOpts.json ?? globalOpts.json);
  const resolved = resolveClientConfig({
    url: cmdOpts.url || globalOpts.url,
    key: cmdOpts.key || globalOpts.key,
  });

  if (!resolved.apiKey) {
    printError(
      new Error(
        'Missing API Key! Please set it via "mcsm config set --key <your-key>" or MCSM_API_KEY environment variable.'
      ),
      isJson
    );
    process.exit(1);
  }

  const mcsm = new MCSMClient({
    baseUrl: resolved.baseUrl,
    apiKey: resolved.apiKey,
  });

  return { mcsm, isJson };
}

// -------------------------------------------------------------
// 1. Config Commands
// -------------------------------------------------------------
const configCmd = program.command('config').description('Manage CLI credentials & settings');

configCmd
  .command('set [url] [key]')
  .description('Save panel URL or API Key permanently')
  .option('-u, --url <url>', 'Panel URL')
  .option('-k, --key <key>', 'API Key')
  .action((posUrl, posKey, opts, cmd) => {
    const isJson = Boolean(program.opts().json);
    const allOpts = cmd?.optsWithGlobals ? cmd.optsWithGlobals() : { ...program.opts(), ...opts };
    const targetUrl = (typeof posUrl === 'string' ? posUrl : undefined) || allOpts.url;
    const targetKey = (typeof posKey === 'string' ? posKey : undefined) || allOpts.key;

    if (!targetUrl && !targetKey) {
      printError(new Error('Please provide --url or --key to save.'), isJson);
      return;
    }
    const update: Record<string, string> = {};
    if (targetUrl) update.url = targetUrl;
    if (targetKey) update.apiKey = targetKey;
    saveStoredConfig(update);
    printOutput({ success: true, message: `Configuration saved to ${getStoredConfigPath()}` }, isJson);
  });

configCmd
  .command('get')
  .description('Display current saved config and path')
  .action(() => {
    const isJson = Boolean(program.opts().json);
    const stored = loadStoredConfig();
    const effective = resolveClientConfig(program.opts());
    printOutput(
      {
        configFile: getStoredConfigPath(),
        saved: {
          url: stored.url || null,
          apiKey: maskApiKey(stored.apiKey),
        },
        effective: {
          url: effective.baseUrl,
          apiKey: maskApiKey(effective.apiKey),
        },
      },
      isJson
    );
  });

// -------------------------------------------------------------
// 2. Overview Command
// -------------------------------------------------------------
program
  .command('overview')
  .description('Get panel overview, system resources, and node statistics')
  .action(async () => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.get('/api/overview');
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

// -------------------------------------------------------------
// 3. Daemon Commands
// -------------------------------------------------------------
const daemonCmd = program.command('daemon').description('Manage remote daemon nodes');

daemonCmd
  .command('list')
  .description('List all daemon nodes')
  .option(
    '-m, --mode <mode>',
    'List mode: "basic", "with_instances", "with_system_metrics"',
    'with_instances'
  )
  .action(async (opts) => {
    const { mcsm, isJson } = getClient();
    try {
      let endpoint = '/api/service/remote_services';
      if (opts.mode === 'basic') endpoint = '/api/service/remote_services_list';
      if (opts.mode === 'with_system_metrics') endpoint = '/api/service/remote_services_system';
      const data = await mcsm.get(endpoint);
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

daemonCmd
  .command('add <ip> <port> <apiKey> <remarks>')
  .description('Register a new remote daemon node (Admin only)')
  .option('--prefix <prefix>', 'Custom URL prefix if any', '')
  .action(async (ip, port, apiKey, remarks, opts) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.post('/api/service/remote_service', {
        ip,
        port: Number(port),
        apiKey,
        remarks,
        prefix: opts.prefix || '',
      });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

daemonCmd
  .command('rm <uuid>')
  .description('Remove a registered daemon node (Admin only)')
  .action(async (uuid) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.delete('/api/service/remote_service', undefined, { uuid });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

daemonCmd
  .command('link <uuid>')
  .description('Test and reconnect to a daemon node')
  .action(async (uuid) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.get('/api/service/link_remote_service', { uuid });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

daemonCmd
  .command('search <keyword>')
  .description('Search instances globally across all daemon nodes')
  .option('-p, --page <page>', 'Page number', '1')
  .option('-s, --page-size <pageSize>', 'Page size (1-50)', '20')
  .action(async (keyword, opts) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.get('/api/service/remote_services_instances_global', {
        instance_name: keyword,
        page: Number(opts.page) || 1,
        page_size: clampPageSize(opts.pageSize, 20, 50),
      });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

// -------------------------------------------------------------
// 4. Instance Commands
// -------------------------------------------------------------
const instanceCmd = program.command('instance').description('Control and manage instances');

instanceCmd
  .command('list <daemonId>')
  .description('List instances on a specific daemon node')
  .option('-p, --page <page>', 'Page number', '1')
  .option('-s, --page-size <pageSize>', 'Page size (1-50)', '20')
  .option('-n, --name <name>', 'Filter by instance nickname')
  .option('--status <status>', 'Filter by status code (-1=busy, 0=stopped, 1=stopping, 2=starting, 3=running)')
  .action(async (daemonId, opts) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.get('/api/service/remote_service_instances', {
        daemonId,
        page: Number(opts.page) || 1,
        page_size: clampPageSize(opts.pageSize, 20, 50),
        instance_name: opts.name,
        status: opts.status,
      });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

instanceCmd
  .command('get <daemonId> <uuid>')
  .description('Get real-time details of an instance')
  .action(async (daemonId, uuid) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.get('/api/instance', { daemonId, uuid });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

instanceCmd
  .command('create <daemonId> [configJson]')
  .description('Create a new instance on a daemon node')
  .option('-f, --file <filePath>', 'Path to JSON configuration file')
  .option('--name <nickname>', 'Instance nickname')
  .option('--cmd <startCommand>', 'Command to start the process')
  .option('--cwd <cwd>', 'Working directory relative to daemon root')
  .action(async (daemonId, configJson, opts) => {
    const { mcsm, isJson } = getClient();
    try {
      let config: any = {};
      if (opts.file) {
        config = JSON.parse(fs.readFileSync(opts.file, 'utf-8'));
      } else if (configJson) {
        config = JSON.parse(configJson);
      }
      if (opts.name) config.nickname = opts.name;
      if (opts.cmd) config.startCommand = opts.cmd;
      if (opts.cwd) config.cwd = opts.cwd;

      if (!config.nickname || !config.startCommand || !config.cwd) {
        throw new Error('Instance creation requires "nickname", "startCommand", and "cwd" in config or flags');
      }

      // Validate cwd traversal
      validateSafePath(config.cwd);

      const data = await mcsm.post('/api/instance', config, { daemonId });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

instanceCmd
  .command('update <daemonId> <uuid> [configJson]')
  .description('Update configuration of an existing instance')
  .option('-f, --file <filePath>', 'Path to JSON configuration file')
  .action(async (daemonId, uuid, configJson, opts) => {
    const { mcsm, isJson } = getClient();
    try {
      let config: any = {};
      if (opts.file) {
        config = JSON.parse(fs.readFileSync(opts.file, 'utf-8'));
      } else if (configJson) {
        config = JSON.parse(configJson);
      } else {
        throw new Error('Configuration JSON string or --file is required');
      }

      try {
        // Admin update
        const data = await mcsm.put('/api/instance', config, { daemonId, uuid });
        printOutput(data, isJson);
      } catch (err: any) {
        // If 403, fallback to user update
        if (err.message && (err.message.includes('403') || err.message.includes('Forbidden'))) {
          const fallbackData = await mcsm.put('/api/protected_instance/instance_update', config, {
            daemonId,
            uuid,
          });
          printOutput(fallbackData, isJson);
        } else {
          throw err;
        }
      }
    } catch (err) {
      printError(err, isJson);
    }
  });

instanceCmd
  .command('start <daemonId> <uuid>')
  .description('Start an instance')
  .action(async (daemonId, uuid) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.get('/api/protected_instance/open', { daemonId, uuid });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

instanceCmd
  .command('stop <daemonId> <uuid>')
  .description('Gracefully stop an instance')
  .action(async (daemonId, uuid) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.get('/api/protected_instance/stop', { daemonId, uuid });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

instanceCmd
  .command('restart <daemonId> <uuid>')
  .description('Restart an instance')
  .action(async (daemonId, uuid) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.get('/api/protected_instance/restart', { daemonId, uuid });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

instanceCmd
  .command('kill <daemonId> <uuid>')
  .description('Forcefully kill an instance process (Warning: may corrupt world saves)')
  .action(async (daemonId, uuid) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.get('/api/protected_instance/kill', { daemonId, uuid });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

instanceCmd
  .command('cmd <daemonId> <uuid> <commandText...>')
  .description('Send a terminal command string into the running instance')
  .action(async (daemonId, uuid, commandText) => {
    const { mcsm, isJson } = getClient();
    try {
      const command = commandText.join(' ');
      validateNoNewlines(command);

      // Use POST with query parameters to avoid logging sensitive commands in GET query logs
      const data = await mcsm.post(
        '/api/protected_instance/command',
        { command },
        { daemonId, uuid, command }
      );
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

instanceCmd
  .command('log <daemonId> <uuid>')
  .description('Get console output log from an instance')
  .option('-s, --size <size>', 'Log size limit (default: 20KB, max: 100KB)', '20KB')
  .action(async (daemonId, uuid, opts) => {
    const { mcsm, isJson } = getClient();
    try {
      let sizeStr = opts.size || '20KB';
      // Cap at 100KB
      const numMatch = sizeStr.match(/^(\d+)(kb|b|mb)?$/i);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        const unit = (numMatch[2] || 'kb').toLowerCase();
        if (unit === 'mb' || (unit === 'kb' && num > 100)) {
          sizeStr = '100KB';
        }
      }
      const data = await mcsm.get('/api/protected_instance/outputlog', {
        daemonId,
        uuid,
        size: sizeStr,
      });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

instanceCmd
  .command('rm <daemonId> <uuid>')
  .description('Delete an instance')
  .option('--delete-file', 'Permanently remove files on disk', false)
  .action(async (daemonId, uuid, opts) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.delete(
        '/api/instance',
        { uuids: [uuid], deleteFile: opts.deleteFile },
        { daemonId }
      );
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

// -------------------------------------------------------------
// 5. File Commands
// -------------------------------------------------------------
const fileCmd = program.command('file').description('Manage files inside instance directories');

fileCmd
  .command('ls <daemonId> <uuid> [target]')
  .description('List files and folders in an instance directory')
  .option('-p, --page <page>', 'Page number (starts from 0)', '0')
  .option('-s, --page-size <pageSize>', 'Page size (1-100)', '50')
  .action(async (daemonId, uuid, target = '/', opts) => {
    const { mcsm, isJson } = getClient();
    try {
      const safeTarget = validateSafePath(target, true);
      const data = await mcsm.get('/api/files/list', {
        daemonId,
        uuid,
        target: safeTarget,
        page: Number(opts.page) || 0,
        page_size: clampPageSize(opts.pageSize, 50, 100),
        file_name: '',
      });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

fileCmd
  .command('status <daemonId> <uuid>')
  .description('Get file system status, active downloads, and background file tasks')
  .action(async (daemonId, uuid) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.get('/api/files/status', { daemonId, uuid });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

fileCmd
  .command('cat <daemonId> <uuid> <target>')
  .description('Read text content of a file')
  .option('--force', 'Force read even if target is identified as binary file', false)
  .option('--max-size <maxSize>', 'Max bytes to read (default: 1048576 = 1MB)', '1048576')
  .action(async (daemonId, uuid, target, opts) => {
    const { mcsm, isJson } = getClient();
    try {
      const safeTarget = validateSafePath(target, false);
      if (isBinaryPath(safeTarget) && !opts.force) {
        throw new Error(
          `Target file "${safeTarget}" appears to be a binary file. Reading directly may cause OOM. Use download or pass --force.`
        );
      }
      const data = await mcsm.put('/api/files/', { target: safeTarget }, { daemonId, uuid });
      if (typeof data === 'string' && data.length > Number(opts.maxSize)) {
        const truncated = data.slice(0, Number(opts.maxSize)) + '\n... [TRUNCATED DUE TO SIZE LIMIT]';
        printOutput(truncated, isJson);
        return;
      }
      if (!isJson && typeof data === 'string') {
        process.stdout.write(data);
        if (!data.endsWith('\n')) process.stdout.write('\n');
      } else {
        printOutput(data, isJson);
      }
    } catch (err) {
      printError(err, isJson);
    }
  });

fileCmd
  .command('write <daemonId> <uuid> <target> [text]')
  .description('Write text content into a file (supports stdin or --file)')
  .option('-f, --file <localFilePath>', 'Path to local file to upload')
  .action(async (daemonId, uuid, target, text, opts) => {
    const { mcsm, isJson } = getClient();
    try {
      const safeTarget = validateSafePath(target, false);
      let contentToWrite: string;

      if (opts.file) {
        contentToWrite = fs.readFileSync(opts.file, 'utf-8');
      } else if (text !== undefined && text !== '-') {
        contentToWrite = text;
      } else {
        // Read from stdin
        contentToWrite = await readStdin();
      }

      const data = await mcsm.put(
        '/api/files/',
        { target: safeTarget, text: contentToWrite },
        { daemonId, uuid }
      );
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

fileCmd
  .command('upload <daemonId> <uuid> <localPath> <target>')
  .description('Upload a local binary or text file directly to an instance')
  .option('--unzip', 'Extract the uploaded archive after transfer', false)
  .option('-c, --code <code>', 'Filename encoding when extracting an archive', 'utf-8')
  .option('--keep-existing', 'Keep an existing remote file and auto-rename the uploaded file', false)
  .option('--daemon-addr <address>', 'Override the upload daemon address (host:port or http(s) URL)')
  .action(async (daemonId, uuid, localPath, target, opts) => {
    const { mcsm, isJson } = getClient();
    try {
      const safeTarget = validateSafePath(target, false);
      const result = await mcsm.uploadFile(daemonId, uuid, localPath, safeTarget, {
        unzip: opts.unzip,
        code: opts.unzip ? opts.code : undefined,
        keepExisting: opts.keepExisting,
        daemonAddress: opts.daemonAddr,
      });
      printOutput({ success: true, target: safeTarget, result }, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

fileCmd
  .command('rm <daemonId> <uuid> <targets...>')
  .description('Delete files or directories')
  .action(async (daemonId, uuid, targets) => {
    const { mcsm, isJson } = getClient();
    try {
      const safeTargets = (targets as string[]).map((t: string) => validateSafePath(t, false));
      const data = await mcsm.delete('/api/files', { targets: safeTargets }, { daemonId, uuid });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

fileCmd
  .command('mkdir <daemonId> <uuid> <target>')
  .description('Create a new directory')
  .action(async (daemonId, uuid, target) => {
    const { mcsm, isJson } = getClient();
    try {
      const safeTarget = validateSafePath(target, false);
      const data = await mcsm.post('/api/files/mkdir', { target: safeTarget }, { daemonId, uuid });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

fileCmd
  .command('download <daemonId> <uuid> <url> <fileName>')
  .description('Download a file from Web URL to the instance directory')
  .action(async (daemonId, uuid, url, fileName) => {
    const { mcsm, isJson } = getClient();
    try {
      checkSafeDownloadUrl(url);
      const safeFileName = validateSafePath(fileName, false);
      const data = await mcsm.post(
        '/api/files/download_from_url',
        { url, file_name: safeFileName },
        { daemonId, uuid }
      );
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

fileCmd
  .command('zip <daemonId> <uuid> <sourceZip> <targets...>')
  .description('Compress files into a ZIP archive')
  .option('-c, --code <code>', 'Encoding for zip filenames (utf-8, gbk, big5)', 'utf-8')
  .action(async (daemonId, uuid, sourceZip, targets, opts) => {
    const { mcsm, isJson } = getClient();
    try {
      const safeSource = validateSafePath(sourceZip, false);
      const safeTargets = (targets as string[]).map((t: string) => validateSafePath(t, false));
      const data = await mcsm.post(
        '/api/files/compress',
        { type: 1, code: opts.code || 'utf-8', source: safeSource, targets: safeTargets },
        { daemonId, uuid }
      );
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

fileCmd
  .command('unzip <daemonId> <uuid> <sourceZip> <targetDir>')
  .description('Decompress a ZIP archive into a destination directory')
  .option('-c, --code <code>', 'Encoding for zip archive (utf-8, gbk, big5)', 'utf-8')
  .action(async (daemonId, uuid, sourceZip, targetDir, opts) => {
    const { mcsm, isJson } = getClient();
    try {
      const safeSource = validateSafePath(sourceZip, false);
      const safeTarget = validateSafePath(targetDir, true);
      const data = await mcsm.post(
        '/api/files/compress',
        { type: 2, code: opts.code || 'utf-8', source: safeSource, targets: safeTarget },
        { daemonId, uuid }
      );
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

// -------------------------------------------------------------
// 6. User Commands
// -------------------------------------------------------------
const userCmd = program.command('user').description('User and permission management');

userCmd
  .command('list')
  .description('List registered users (Admin only)')
  .option('-p, --page <page>', 'Page number', '1')
  .option('-s, --page-size <pageSize>', 'Page size (1-50)', '20')
  .option('-n, --name <name>', 'Fuzzy username search')
  .action(async (opts) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.get('/api/auth/search', {
        page: Number(opts.page) || 1,
        page_size: clampPageSize(opts.pageSize, 20, 50),
        userName: opts.name,
      });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

userCmd
  .command('me')
  .description('Get current authenticated user info and allocated instances')
  .option('--advanced', 'Resolve detailed instance statuses', false)
  .action(async (opts) => {
    const { mcsm, isJson } = getClient();
    try {
      const rawData = await mcsm.get('/api/auth', { advanced: opts.advanced });
      const data = desensitizeUserInfo(rawData);
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

// -------------------------------------------------------------
// 7. Mod Commands
// -------------------------------------------------------------
const modCmd = program.command('mod').description('Minecraft Mod management');

modCmd
  .command('search <query>')
  .description('Search mods across Modrinth, CurseForge, and SpigotMC')
  .option('-s, --source <source>', 'Platform source (all, modrinth, curseforge, spigotmc)', 'all')
  .option('-v, --version <version>', 'Minecraft version')
  .option('-l, --loader <loader>', 'Mod loader (fabric, forge, quilt, etc.)')
  .option('-e, --environment <environment>', 'Environment filter: "all", "client", "server"', 'all')
  .action(async (query, opts) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.get('/api/mod/search', {
        query,
        source: opts.source,
        version: opts.version,
        loader: opts.loader,
        environment: opts.environment,
      });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

modCmd
  .command('list <daemonId> <uuid>')
  .description('List installed mods in an instance')
  .action(async (daemonId, uuid) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.get('/api/mod/list', { daemonId, uuid });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

modCmd
  .command('toggle <daemonId> <uuid> <fileName>')
  .description('Toggle mod enabled / disabled status')
  .action(async (daemonId, uuid, fileName) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.post('/api/mod/toggle', { daemonId, uuid, fileName });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

// -------------------------------------------------------------
// 8. Schedule Commands
// -------------------------------------------------------------
const scheduleCmd = program.command('schedule').description('Manage scheduled tasks for an instance');

scheduleCmd
  .command('list <daemonId> <uuid>')
  .description('List scheduled tasks of an instance')
  .action(async (daemonId, uuid) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.get('/api/protected_schedule', { daemonId, uuid });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

scheduleCmd
  .command('create <daemonId> <uuid> <name> <time> <actions...>')
  .description('Create a scheduled task (e.g. restart or terminal command)')
  .option('-t, --type <type>', 'Task type: 1 = Cron-like, 2 = Interval', '1')
  .option('-c, --count <count>', 'Execution count: -1 = repeat forever, N = times', '-1')
  .action(async (daemonId, uuid, name, time, actions, opts) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.post(
        '/api/protected_schedule',
        {
          name,
          time,
          actions,
          type: Number(opts.type) || 1,
          count: Number(opts.count) ?? -1,
        },
        { daemonId, uuid }
      );
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

scheduleCmd
  .command('rm <daemonId> <uuid> <name>')
  .description('Delete a scheduled task')
  .action(async (daemonId, uuid, name) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.delete('/api/protected_schedule', undefined, {
        daemonId,
        uuid,
        task_name: name,
      });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

// -------------------------------------------------------------
// 9. Java Runtime Commands
// -------------------------------------------------------------
const javaCmd = program.command('java').description('Manage Java runtime environments on a daemon');

javaCmd
  .command('list <daemonId> <instanceId>')
  .description('List available Java runtimes')
  .action(async (daemonId, instanceId) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.get('/api/java_manager/list', { daemonId, instanceId });
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

javaCmd
  .command('add <daemonId> <instanceId> <name> <path>')
  .description('Register a custom local Java executable path (Admin only)')
  .action(async (daemonId, instanceId, name, javaPath) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.post(
        '/api/java_manager/add',
        { name, path: javaPath },
        { daemonId, instanceId }
      );
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

javaCmd
  .command('download <daemonId> <instanceId> <name> <version>')
  .description('Download and install a Java version on the daemon')
  .action(async (daemonId, instanceId, name, version) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.post(
        '/api/java_manager/download',
        { name, version },
        { daemonId, instanceId }
      );
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

javaCmd
  .command('use <daemonId> <instanceId> <runtimeId>')
  .description('Bind a Java runtime to the instance')
  .action(async (daemonId, instanceId, runtimeId) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.post(
        '/api/java_manager/using',
        { id: runtimeId },
        { daemonId, instanceId }
      );
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

javaCmd
  .command('rm <daemonId> <instanceId> <runtimeId>')
  .description('Delete a Java runtime configuration')
  .action(async (daemonId, instanceId, runtimeId) => {
    const { mcsm, isJson } = getClient();
    try {
      const data = await mcsm.delete(
        '/api/java_manager/delete',
        { id: runtimeId },
        { daemonId, instanceId }
      );
      printOutput(data, isJson);
    } catch (err) {
      printError(err, isJson);
    }
  });

// -------------------------------------------------------------
// Execute CLI
// -------------------------------------------------------------
async function run() {
  try {
    await program.parseAsync(process.argv);
  } catch (err: any) {
    if (err.code?.startsWith('commander.')) {
      process.exit(err.exitCode ?? 1);
    }
    const isJson = process.argv.includes('-j') || process.argv.includes('--json');
    printError(err, isJson);
    process.exit(1);
  }
}

// Only execute when invoked directly as a script
if (process.env.NODE_ENV !== 'test') {
  run();
}

export { program, getClient };

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import * as config from '../src/config.js';
import { createProgram } from '../src/cli/program.js';

const ids = { daemonId: 'daemon', uuid: 'instance' };
const credentials = ['-u', 'http://panel.example', '-k', 'test-key', '-j'];
const fake = () => ({
  get: vi.fn().mockResolvedValue({ ok: true }),
  post: vi.fn().mockResolvedValue({ ok: true }),
  put: vi.fn().mockResolvedValue({ ok: true }),
  delete: vi.fn().mockResolvedValue({ ok: true }),
  uploadFile: vi.fn().mockResolvedValue('uploaded'),
});
let client: ReturnType<typeof fake>;
let createClient: ReturnType<typeof vi.fn>;
let readStdin: ReturnType<typeof vi.fn>;
let originalExitCode: typeof process.exitCode;

beforeEach(() => {
  originalExitCode = process.exitCode;
  process.exitCode = undefined;
  vi.stubEnv('MCSM_BASE_URL', '');
  vi.stubEnv('MCSM_API_KEY', '');
  vi.spyOn(fs, 'existsSync').mockReturnValue(false);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  client = fake();
  createClient = vi.fn().mockReturnValue(client);
  readStdin = vi.fn().mockResolvedValue('stdin content');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  process.exitCode = originalExitCode;
});

async function invoke(args: string[]) {
  const program = createProgram({ createClient, readStdin });
  await program.parseAsync([...credentials, ...args], { from: 'user' });
  return program;
}
function result() {
  return JSON.parse(vi.mocked(console.log).mock.calls.at(-1)![0] as string);
}
function error() {
  return JSON.parse(vi.mocked(console.error).mock.calls.at(-1)![0] as string);
}

type Route = [string, string[], keyof ReturnType<typeof fake>, unknown[]];
const routes: Route[] = [
  ['overview', ['overview'], 'get', ['/api/overview']],
  ['daemon list default', ['daemon', 'list'], 'get', ['/api/service/remote_services']],
  ['daemon list basic', ['daemon', 'list', '--mode', 'basic'], 'get', ['/api/service/remote_services_list']],
  ['daemon list metrics', ['daemon', 'list', '--mode', 'with_system_metrics'], 'get', ['/api/service/remote_services_system']],
  ['daemon list unknown mode preserves fallback', ['daemon', 'list', '--mode', 'unknown'], 'get', ['/api/service/remote_services']],
  ['daemon add', ['daemon', 'add', 'node.example', '24444', 'node-key', 'Main'], 'post', ['/api/service/remote_service', { ip: 'node.example', port: 24444, apiKey: 'node-key', remarks: 'Main', prefix: '' }]],
  ['daemon remove', ['daemon', 'rm', 'daemon'], 'delete', ['/api/service/remote_service', undefined, { uuid: 'daemon' }]],
  ['daemon link', ['daemon', 'link', 'daemon'], 'get', ['/api/service/link_remote_service', { uuid: 'daemon' }]],
  ['daemon search defaults', ['daemon', 'search', 'Minecraft'], 'get', ['/api/service/remote_services_instances_global', { instance_name: 'Minecraft', page: 1, page_size: 20 }]],
  ['instance list defaults', ['instance', 'list', 'daemon'], 'get', ['/api/service/remote_service_instances', { daemonId: 'daemon', page: 1, page_size: 20, instance_name: undefined, status: undefined }]],
  ['instance get', ['instance', 'get', 'daemon', 'instance'], 'get', ['/api/instance', ids]],
  ...(['start', 'stop', 'restart', 'kill'] as const).map((verb): Route => [`instance ${verb}`, ['instance', verb, 'daemon', 'instance'], 'get', [`/api/protected_instance/${verb === 'start' ? 'open' : verb}`, ids]]),
  ['instance command', ['instance', 'cmd', 'daemon', 'instance', 'say', 'hello world'], 'post', ['/api/protected_instance/command', { command: 'say hello world' }, { ...ids, command: 'say hello world' }]],
  ['instance log defaults', ['instance', 'log', 'daemon', 'instance'], 'get', ['/api/protected_instance/outputlog', { ...ids, size: '20KB' }]],
  ['instance remove defaults', ['instance', 'rm', 'daemon', 'instance'], 'delete', ['/api/instance', { uuids: ['instance'], deleteFile: false }, { daemonId: 'daemon' }]],
  ['instance remove files', ['instance', 'rm', 'daemon', 'instance', '--delete-file'], 'delete', ['/api/instance', { uuids: ['instance'], deleteFile: true }, { daemonId: 'daemon' }]],
  ['file list defaults', ['file', 'ls', 'daemon', 'instance'], 'get', ['/api/files/list', { ...ids, target: '/', page: 0, page_size: 50, file_name: '' }]],
  ['file status', ['file', 'status', 'daemon', 'instance'], 'get', ['/api/files/status', ids]],
  ['file cat', ['file', 'cat', 'daemon', 'instance', './server.properties'], 'put', ['/api/files/', { target: '/server.properties' }, ids]],
  ['file write text', ['file', 'write', 'daemon', 'instance', 'server.properties', 'motd=Hello'], 'put', ['/api/files/', { target: '/server.properties', text: 'motd=Hello' }, ids]],
  ['file upload defaults', ['file', 'upload', 'daemon', 'instance', 'local.jar', './mods/mod.jar'], 'uploadFile', ['daemon', 'instance', 'local.jar', '/mods/mod.jar', { unzip: false, code: undefined, keepExisting: false, daemonAddress: undefined }]],
  ['file upload options', ['file', 'upload', 'daemon', 'instance', 'local.zip', 'mods/mod.zip', '--unzip', '--code', 'gbk', '--keep-existing', '--daemon-addr', 'http://node.example:24444'], 'uploadFile', ['daemon', 'instance', 'local.zip', '/mods/mod.zip', { unzip: true, code: 'gbk', keepExisting: true, daemonAddress: 'http://node.example:24444' }]],
  ['file remove', ['file', 'rm', 'daemon', 'instance', 'one.txt', 'folder/two.txt'], 'delete', ['/api/files', { targets: ['/one.txt', '/folder/two.txt'] }, ids]],
  ['file mkdir', ['file', 'mkdir', 'daemon', 'instance', 'plugins'], 'post', ['/api/files/mkdir', { target: '/plugins' }, ids]],
  ['file download', ['file', 'download', 'daemon', 'instance', 'https://cdn.example/mod.jar', 'mods/mod.jar'], 'post', ['/api/files/download_from_url', { url: 'https://cdn.example/mod.jar', file_name: '/mods/mod.jar' }, ids]],
  ['file zip defaults', ['file', 'zip', 'daemon', 'instance', 'backup.zip', 'world', 'server.properties'], 'post', ['/api/files/compress', { type: 1, code: 'utf-8', source: '/backup.zip', targets: ['/world', '/server.properties'] }, ids]],
  ['file unzip defaults', ['file', 'unzip', 'daemon', 'instance', 'backup.zip', '/'], 'post', ['/api/files/compress', { type: 2, code: 'utf-8', source: '/backup.zip', targets: '/' }, ids]],
  ['user list defaults', ['user', 'list'], 'get', ['/api/auth/search', { page: 1, page_size: 20, userName: undefined }]],
  ['user me defaults', ['user', 'me'], 'get', ['/api/auth', { advanced: false }]],
  ['user me advanced', ['user', 'me', '--advanced'], 'get', ['/api/auth', { advanced: true }]],
  ['mod search defaults', ['mod', 'search', 'fabric'], 'get', ['/api/mod/search', { query: 'fabric', source: 'all', version: undefined, loader: undefined, environment: 'all' }]],
  ['mod search options', ['mod', 'search', 'sodium', '--source', 'modrinth', '-v', '1.21', '--loader', 'fabric', '--environment', 'client'], 'get', ['/api/mod/search', { query: 'sodium', source: 'modrinth', version: '1.21', loader: 'fabric', environment: 'client' }]],
  ['mod list', ['mod', 'list', 'daemon', 'instance'], 'get', ['/api/mod/list', ids]],
  ['mod toggle', ['mod', 'toggle', 'daemon', 'instance', 'sodium.jar'], 'post', ['/api/mod/toggle', { ...ids, fileName: 'sodium.jar' }]],
  ['schedule list', ['schedule', 'list', 'daemon', 'instance'], 'get', ['/api/protected_schedule', ids]],
  ['schedule create defaults', ['schedule', 'create', 'daemon', 'instance', 'restart', '0 0 * * *', 'stop', 'start'], 'post', ['/api/protected_schedule', { name: 'restart', time: '0 0 * * *', actions: ['stop', 'start'], type: 1, count: -1 }, ids]],
  ['schedule remove', ['schedule', 'rm', 'daemon', 'instance', 'restart'], 'delete', ['/api/protected_schedule', undefined, { ...ids, task_name: 'restart' }]],
  ['java list', ['java', 'list', 'daemon', 'instance'], 'get', ['/api/java_manager/list', { daemonId: 'daemon', instanceId: 'instance' }]],
  ['java add', ['java', 'add', 'daemon', 'instance', 'Java 21', '/opt/java/bin/java'], 'post', ['/api/java_manager/add', { name: 'Java 21', path: '/opt/java/bin/java' }, { daemonId: 'daemon', instanceId: 'instance' }]],
  ['java download', ['java', 'download', 'daemon', 'instance', 'Java 21', '21'], 'post', ['/api/java_manager/download', { name: 'Java 21', version: '21' }, { daemonId: 'daemon', instanceId: 'instance' }]],
  ['java use', ['java', 'use', 'daemon', 'instance', 'runtime'], 'post', ['/api/java_manager/using', { id: 'runtime' }, { daemonId: 'daemon', instanceId: 'instance' }]],
  ['java remove', ['java', 'rm', 'daemon', 'instance', 'runtime'], 'delete', ['/api/java_manager/delete', { id: 'runtime' }, { daemonId: 'daemon', instanceId: 'instance' }]],
];

describe('command API contracts', () => {
  it.each(routes)('%s', async (_name, args, method, expected) => {
    await invoke(args);
    expect(createClient).toHaveBeenCalledWith({ baseUrl: 'http://panel.example', apiKey: 'test-key' });
    expect(client[method].mock.calls).toEqual([expected]);
    for (const other of Object.keys(client) as (keyof typeof client)[]) {
      if (other !== method) expect(client[other]).not.toHaveBeenCalled();
    }
    expect(console.error).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledTimes(1);
  });

  it('preserves pagination fallbacks, caps and filters', async () => {
    await invoke(['instance', 'list', 'daemon', '--page', 'invalid', '--page-size', '999', '--name', 'survival', '--status', '3']);
    expect(client.get).toHaveBeenLastCalledWith('/api/service/remote_service_instances', { daemonId: 'daemon', page: 1, page_size: 50, instance_name: 'survival', status: '3' });
    await invoke(['file', 'ls', 'daemon', 'instance', 'logs', '--page', '2', '--page-size', '999']);
    expect(client.get).toHaveBeenLastCalledWith('/api/files/list', { ...ids, target: '/logs', page: 2, page_size: 100, file_name: '' });
    await invoke(['user', 'list', '--page', '0', '--page-size', '0', '--name', 'admin']);
    expect(client.get).toHaveBeenLastCalledWith('/api/auth/search', { page: 1, page_size: 20, userName: 'admin' });
  });

  it('passes explicit daemon and archive options', async () => {
    await invoke(['daemon', 'add', 'node.example', '24444', 'node-key', 'Main', '--prefix', '/node']);
    expect(client.post).toHaveBeenLastCalledWith('/api/service/remote_service', { ip: 'node.example', port: 24444, apiKey: 'node-key', remarks: 'Main', prefix: '/node' });
    await invoke(['file', 'zip', 'daemon', 'instance', 'backup.zip', 'world', '--code', 'gbk']);
    expect(client.post).toHaveBeenLastCalledWith('/api/files/compress', { type: 1, code: 'gbk', source: '/backup.zip', targets: ['/world'] }, ids);
    await invoke(['file', 'unzip', 'daemon', 'instance', 'backup.zip', 'restore', '--code', 'big5']);
    expect(client.post).toHaveBeenLastCalledWith('/api/files/compress', { type: 2, code: 'big5', source: '/backup.zip', targets: '/restore' }, ids);
  });
  it.each(['create', 'update'])('prints malformed file JSON errors for instance %s', async verb => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('{bad file json');
    await invoke(['instance', verb, 'daemon', ...(verb === 'update' ? ['instance'] : []), '--file', 'invalid.json']);
    expect(error()).toMatchObject({ status: 'error', message: expect.any(String) });
    expect(client.post).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
  });
  it('creates an instance from JSON with flag overrides', async () => {
    await invoke(['instance', 'create', 'daemon', '{"nickname":"old","startCommand":"old","cwd":"old","port":25565}', '--name', 'new', '--cmd', 'java -jar server.jar', '--cwd', 'servers/new']);
    expect(client.post).toHaveBeenCalledWith('/api/instance', { nickname: 'new', startCommand: 'java -jar server.jar', cwd: 'servers/new', port: 25565 }, { daemonId: 'daemon' });
  });
  it('creates an instance using flags alone', async () => {
    await invoke(['instance', 'create', 'daemon', '--name', 'new', '--cmd', 'java', '--cwd', 'server']);
    expect(client.post).toHaveBeenCalledWith('/api/instance', { nickname: 'new', startCommand: 'java', cwd: 'server' }, { daemonId: 'daemon' });
  });
  it.each(['create', 'update'])('instance %s prefers file JSON over inline JSON', async verb => {
    const body = { nickname: 'file', startCommand: 'java', cwd: 'server' };
    const read = vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(body));
    await invoke(['instance', verb, 'daemon', ...(verb === 'update' ? ['instance'] : []), '{invalid inline}', '--file', 'config.json']);
    expect(read).toHaveBeenCalledWith('config.json', 'utf-8');
    expect(client[verb === 'create' ? 'post' : 'put']).toHaveBeenCalledWith('/api/instance', body, verb === 'create' ? { daemonId: 'daemon' } : ids);
  });
  it.each(['403', 'Forbidden'])('falls back to protected update on %s', async message => {
    client.put.mockRejectedValueOnce(new Error(message));
    await invoke(['instance', 'update', 'daemon', 'instance', '{"nickname":"updated"}']);
    expect(client.put.mock.calls).toEqual([
      ['/api/instance', { nickname: 'updated' }, ids],
      ['/api/protected_instance/instance_update', { nickname: 'updated' }, ids],
    ]);
    expect(console.error).not.toHaveBeenCalled();
  });
  it('prints a non-permission update error without retrying', async () => {
    client.put.mockRejectedValueOnce(new Error('connection lost'));
    await invoke(['instance', 'update', 'daemon', 'instance', '{}']);
    expect(client.put).toHaveBeenCalledTimes(1);
    expect(error()).toEqual({ status: 'error', message: 'connection lost' });
    expect(process.exitCode).toBe(1);
  });
  it.each(['create', 'update'])('prints malformed JSON errors for instance %s', async verb => {
    await invoke(['instance', verb, 'daemon', ...(verb === 'update' ? ['instance'] : []), '{bad json']);
    expect(error()).toMatchObject({ status: 'error', message: expect.any(String) });
    expect(client.post).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
  });
  it('rejects missing creation fields and missing update input', async () => {
    await invoke(['instance', 'create', 'daemon', '{}']);
    expect(error().message).toContain('requires');
    await invoke(['instance', 'update', 'daemon', 'instance']);
    expect(error().message).toContain('required');
    expect(client.post).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
  });
});

describe('file content and security', () => {
  it.each([[[]], [['-']]])('reads stdin for omitted text or dash: %j', async text => {
    await invoke(['file', 'write', 'daemon', 'instance', 'file.txt', ...text]);
    expect(readStdin).toHaveBeenCalledTimes(1);
    expect(client.put).toHaveBeenCalledWith('/api/files/', { target: '/file.txt', text: 'stdin content' }, ids);
  });
  it('prefers local file over explicit text and stdin', async () => {
    const read = vi.spyOn(fs, 'readFileSync').mockReturnValue('file content');
    await invoke(['file', 'write', 'daemon', 'instance', 'file.txt', 'inline', '--file', 'local.txt']);
    expect(read).toHaveBeenCalledWith('local.txt', 'utf-8');
    expect(readStdin).not.toHaveBeenCalled();
    expect(client.put).toHaveBeenCalledWith('/api/files/', { target: '/file.txt', text: 'file content' }, ids);
  });
  it('preserves explicitly empty text instead of reading stdin', async () => {
    await invoke(['file', 'write', 'daemon', 'instance', 'file.txt', '']);
    expect(readStdin).not.toHaveBeenCalled();
    expect(client.put).toHaveBeenCalledWith('/api/files/', { target: '/file.txt', text: '' }, ids);
  });
  it('reports stdin errors without writing', async () => {
    readStdin.mockRejectedValueOnce(new Error('stdin failed'));
    await invoke(['file', 'write', 'daemon', 'instance', 'file.txt']);
    expect(client.put).not.toHaveBeenCalled();
    expect(error().message).toBe('stdin failed');
  });
  it('truncates cat output at the requested limit', async () => {
    client.put.mockResolvedValueOnce('abcdef');
    await invoke(['file', 'cat', 'daemon', 'instance', 'file.txt', '--max-size', '3']);
    expect(result()).toBe('abc\n... [TRUNCATED DUE TO SIZE LIMIT]');
  });
  it('blocks binary cat unless forced', async () => {
    await invoke(['file', 'cat', 'daemon', 'instance', 'server.jar']);
    expect(client.put).not.toHaveBeenCalled();
    expect(error().message).toContain('binary file');
    await invoke(['file', 'cat', 'daemon', 'instance', 'server.jar', '--force']);
    expect(client.put).toHaveBeenCalledWith('/api/files/', { target: '/server.jar' }, ids);
  });
  it.each([
    ['file', 'rm', 'daemon', 'instance', '/'],
    ['file', 'mkdir', 'daemon', 'instance', '../escape'],
    ['file', 'write', 'daemon', 'instance', '../escape', 'text'],
    ['instance', 'cmd', 'daemon', 'instance', 'say hello\nstop'],
    ['file', 'download', 'daemon', 'instance', 'http://[::1]/secret', 'secret.txt'],
  ])('rejects unsafe input %j before making requests', async (...args) => {
    await invoke(args);
    expect(console.error).toHaveBeenCalledTimes(1);
    for (const method of Object.values(client)) expect(method).not.toHaveBeenCalled();
  });
});

describe('approved validation changes', () => {
  it.each(['-2', '1.5', 'NaN', 'Infinity', '9007199254740992', 'garbage'])('rejects schedule count %s', async count => {
    await invoke(['schedule', 'create', 'daemon', 'instance', 'task', '60', 'restart', '--count', count]);
    expect(client.post).not.toHaveBeenCalled();
    expect(error()).toMatchObject({ status: 'error', message: expect.stringMatching(/count/i) });
  });
  it.each(['-1', '0', '3', '9007199254740991'])('accepts schedule count %s', async count => {
    await invoke(['schedule', 'create', 'daemon', 'instance', 'task', '60', 'restart', '--type', '2', '--count', count]);
    expect(client.post).toHaveBeenCalledWith('/api/protected_schedule', { name: 'task', time: '60', actions: ['restart'], type: 2, count: Number(count) }, ids);
  });
  it.each(['102401B', '999999B', '101KB', '1MB', '500'])('clamps log size %s to 100KB', async size => {
    await invoke(['instance', 'log', 'daemon', 'instance', '--size', size]);
    expect(client.get).toHaveBeenCalledWith('/api/protected_instance/outputlog', { ...ids, size: '100KB' });
  });
  it.each(['102400B', '1B', '100KB', '20kb', '0MB', 'custom'])('preserves log size %s below cap or outside recognized format', async size => {
    await invoke(['instance', 'log', 'daemon', 'instance', '--size', size]);
    expect(client.get).toHaveBeenCalledWith('/api/protected_instance/outputlog', { ...ids, size });
  });
});

describe('configuration and output', () => {
  it('saves config positional arguments ahead of flags without creating a client', async () => {
    const save = vi.spyOn(config, 'saveStoredConfig').mockImplementation(() => {});
    await invoke(['config', 'set', 'http://saved.example', 'saved-key', '--url', 'http://ignored.example', '--key', 'ignored-key']);
    expect(save).toHaveBeenCalledWith({ url: 'http://saved.example', apiKey: 'saved-key' });
    expect(createClient).not.toHaveBeenCalled();
    expect(result()).toMatchObject({ success: true });
  });
  it('saves config flags without creating a client', async () => {
    const save = vi.spyOn(config, 'saveStoredConfig').mockImplementation(() => {});
    await invoke(['config', 'set']);
    expect(save).toHaveBeenCalledWith({ url: 'http://panel.example', apiKey: 'test-key' });
    expect(createClient).not.toHaveBeenCalled();
  });
  it('rejects empty config set without writing credentials', async () => {
    const save = vi.spyOn(config, 'saveStoredConfig').mockImplementation(() => {});
    await createProgram({ createClient }).parseAsync(['--json', 'config', 'set'], { from: 'user' });
    expect(save).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(error().message).toContain('Please provide');
  });
  it('prints config get with masked keys without creating a client', async () => {
    await invoke(['config', 'get']);
    expect(result()).toMatchObject({ saved: { url: null, apiKey: null }, effective: { url: 'http://panel.example', apiKey: '********' } });
    expect(createClient).not.toHaveBeenCalled();
  });
  it('redacts user details without mutating the client response', async () => {
    const raw = { userName: 'admin', apiKey: '1234567890abcdef', secret: 'secret', passWord: 'password', salt: 'salt', permission: 10 };
    client.get.mockResolvedValueOnce(raw);
    await invoke(['user', 'me']);
    expect(result()).toEqual({ userName: 'admin', apiKey: '123...def', secret: '[REDACTED]', passWord: '', salt: '', permission: 10 });
    expect(raw.secret).toBe('secret');
    expect(raw.passWord).toBe('password');
  });
});

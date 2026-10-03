import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import { createProgram } from '../src/cli/program.js';
import { runCli } from '../src/cli/run.js';

const credentials = ['-u', 'http://panel.example', '-k', 'test-key'];
let originalExitCode: typeof process.exitCode;
let client: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn>; uploadFile: ReturnType<typeof vi.fn> };
let createClient: ReturnType<typeof vi.fn>;

beforeEach(() => {
  originalExitCode = process.exitCode;
  process.exitCode = undefined;
  vi.stubEnv('MCSM_BASE_URL', '');
  vi.stubEnv('MCSM_API_KEY', '');
  vi.spyOn(fs, 'existsSync').mockReturnValue(false);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  client = {
    get: vi.fn().mockResolvedValue('response'),
    post: vi.fn().mockResolvedValue('response'),
    put: vi.fn().mockResolvedValue('response'),
    delete: vi.fn().mockResolvedValue('response'),
    uploadFile: vi.fn().mockResolvedValue('response'),
  };
  createClient = vi.fn().mockReturnValue(client);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  process.exitCode = originalExitCode;
});

describe('createProgram lifecycle', () => {
  it('constructs independent command trees without parsing or creating clients', () => {
    const first = createProgram({ createClient });
    const second = createProgram({ createClient });
    expect(first).not.toBe(second);
    expect(first.commands[0]).not.toBe(second.commands[0]);
    expect(first.name()).toBe('mcsm');
    expect(first.opts()).toEqual({ json: false });
    expect(createClient).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('importing CLI modules has no parsing, output or client side effects', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('unexpected process.exit'); }) as any);
    const axios = await import('axios');
    const axiosCreate = vi.spyOn(axios.default, 'create');
    const { Command } = await import('commander');
    const parse = vi.spyOn(Command.prototype, 'parseAsync');
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.resetModules();
    await import('../src/cli/program.js');
    await import('../src/cli/run.js');
    expect(parse).not.toHaveBeenCalled();
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();
    expect(axiosCreate).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([
    [...credentials, '-j', 'overview'],
    ['overview', ...credentials, '--json'],
    ['daemon', ...credentials, '--json', 'list'],
    ['daemon', 'list', ...credentials, '--json'],
  ])('accepts global options at supported positions: %j', async (...args) => {
    const program = createProgram({ createClient });
    await program.parseAsync(args, { from: 'user' });
    expect(createClient).toHaveBeenCalledWith({ baseUrl: 'http://panel.example', apiKey: 'test-key' });
    expect(console.log).toHaveBeenCalledWith('"response"');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('keeps credentials, JSON mode and nested defaults independent between programs', async () => {
    const first = createProgram({ createClient });
    const secondClient = { ...client, get: vi.fn().mockResolvedValue('second response') };
    const secondFactory = vi.fn().mockReturnValue(secondClient);
    const second = createProgram({ createClient: secondFactory });
    await first.parseAsync([...credentials, '-j', 'daemon', 'list', '--mode', 'basic'], { from: 'user' });
    await second.parseAsync(['-u', 'http://second.example', '-k', 'second-key', 'daemon', 'list'], { from: 'user' });
    expect(createClient).toHaveBeenCalledWith({ baseUrl: 'http://panel.example', apiKey: 'test-key' });
    expect(secondFactory).toHaveBeenCalledWith({ baseUrl: 'http://second.example', apiKey: 'second-key' });
    expect(client.get).toHaveBeenCalledWith('/api/service/remote_services_list');
    expect(secondClient.get).toHaveBeenCalledWith('/api/service/remote_services');
    expect(console.log).toHaveBeenNthCalledWith(1, '"response"');
    expect(console.log).toHaveBeenNthCalledWith(2, 'second response');
    expect(first.opts().json).toBe(true);
    expect(second.opts().json).toBe(false);
  });

  it('throws for missing credentials after printing exactly once', async () => {
    const program = createProgram({ createClient });
    await expect(program.parseAsync(['--json', 'overview'], { from: 'user' })).rejects.toThrow();
    expect(createClient).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(vi.mocked(console.error).mock.calls[0][0] as string)).toMatchObject({ status: 'error', message: expect.stringContaining('Missing API Key') });
  });

  it.each(['-j', '--json'])('uses parsed %s for Commander errors instead of process.argv', async flag => {
    const program = createProgram({ createClient });
    await expect(program.parseAsync([flag, 'overview', '--unknown'], { from: 'user' })).rejects.toMatchObject({ code: 'commander.unknownOption' });
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(vi.mocked(console.error).mock.calls[0][0] as string)).toMatchObject({ status: 'error', message: expect.stringContaining('--unknown') });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('preserves plain Commander errors on stderr', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const program = createProgram({ createClient });
    await expect(program.parseAsync(['overview', '--unknown'], { from: 'user' })).rejects.toMatchObject({ code: 'commander.unknownOption' });
    expect(stderr).toHaveBeenCalledTimes(1);
    expect(stderr.mock.calls[0][0]).toContain('--unknown');
    expect(createClient).not.toHaveBeenCalled();
  });

  it('shows root and nested help without requiring credentials', async () => {
    const program = createProgram({ createClient });
    const output = vi.fn();
    program.configureOutput({ writeOut: output });
    await expect(program.parseAsync(['--help'], { from: 'user' })).rejects.toMatchObject({ code: 'commander.helpDisplayed', exitCode: 0 });
    expect(output.mock.calls.map(call => call[0]).join('')).toContain('MCSManager CLI');
    output.mockClear();
    const nested = createProgram({ createClient });
    nested.commands.find(command => command.name() === 'file')!.commands.find(command => command.name() === 'upload')!.configureOutput({ writeOut: output });
    await expect(nested.parseAsync(['file', 'upload', '--help'], { from: 'user' })).rejects.toMatchObject({ code: 'commander.helpDisplayed', exitCode: 0 });
    expect(output.mock.calls.map(call => call[0]).join('')).toContain('--keep-existing');
    expect(createClient).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('reports the package version and exits through Commander override', async () => {
    const program = createProgram({ createClient });
    const output = vi.fn();
    program.configureOutput({ writeOut: output });
    await expect(program.parseAsync(['--version'], { from: 'user' })).rejects.toMatchObject({ code: 'commander.version', exitCode: 0 });
    expect(output).toHaveBeenCalledWith(`${program.version()}\n`);
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe('runCli boundary', () => {
  it('parses a node-style argv and awaits its action', async () => {
    let resolve!: (value: unknown) => void;
    client.get.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const running = runCli(['node', 'mcsm', ...credentials, '--json', 'overview'], { createClient });
    expect(client.get).toHaveBeenCalledWith('/api/overview');
    expect(console.log).not.toHaveBeenCalled();
    resolve({ complete: true });
    await running;
    expect(JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string)).toEqual({ complete: true });
  });
  it('handles missing credentials without duplicate output or process.exit', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('unexpected process.exit'); }) as any);
    await runCli(['node', 'mcsm', '--json', 'overview'], { createClient });
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBe(1);
    expect(createClient).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
  it('sets exitCode for Commander failures without reprinting them', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('unexpected process.exit'); }) as any);
    await runCli(['node', 'mcsm', '--json', 'overview', '--unknown'], { createClient });
    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
  it.each(['--help', '--version'])('treats %s as a successful Commander exit', async flag => {
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await runCli(['node', 'mcsm', flag], { createClient });
    expect(process.exitCode ?? 0).toBe(0);
    expect(console.error).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(output.mock.calls.length + vi.mocked(console.log).mock.calls.length).toBeGreaterThan(0);
  });
});

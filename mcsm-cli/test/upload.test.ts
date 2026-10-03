import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { uploadFile } from '../src/client/upload.js';

vi.mock('axios');

let requestTicket: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(fs, 'statSync').mockReturnValue({ isFile: () => true, size: 4 } as fs.Stats);
  vi.spyOn(fs, 'createReadStream').mockImplementation(() => Readable.from('test') as fs.ReadStream);
  requestTicket = vi.fn().mockResolvedValue({ password: 'ticket /?', addr: 'node.example:24444' });
  vi.mocked(axios.post).mockResolvedValue({ data: 'OK' });
});
afterEach(() => vi.restoreAllMocks());

function upload(target = '/plugins/mod.jar', options = {}) {
  return uploadFile('https://panel.example', requestTicket, 'daemon', 'instance', 'local.jar', target, options);
}

describe('direct daemon upload', () => {
  it('inherits panel protocol, encodes ticket and sends no panel credentials', async () => {
    await expect(upload()).resolves.toBe('OK');
    expect(requestTicket).toHaveBeenCalledWith({ daemonId: 'daemon', uuid: 'instance', upload_dir: '/plugins' });
    const [url, form, options] = vi.mocked(axios.post).mock.calls[0];
    const parsed = new URL(url as string);
    expect(parsed.origin).toBe('https://node.example:24444');
    expect(parsed.pathname).toBe('/upload/ticket%20%2F%3F');
    expect(parsed.search).toBe('');
    expect(form.getHeaders()['content-type']).toMatch(/^multipart\/form-data; boundary=/);
    expect(options).toEqual({ headers: form.getHeaders(), maxBodyLength: Infinity, maxContentLength: Infinity, maxRedirects: 0 });
  });

  it('serializes non-string daemon responses', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { success: true } });
    await expect(upload()).resolves.toBe('{"success":true}');
  });

  it('rejects directories before requesting a ticket', async () => {
    vi.mocked(fs.statSync).mockReturnValueOnce({ isFile: () => false } as fs.Stats);
    await expect(upload()).rejects.toThrow('Upload source is not a file');
    expect(requestTicket).not.toHaveBeenCalled();
  });

  it.each(['relative.jar', '/', '/plugins/../escaped.jar', '\\plugins\\..\\escaped.jar'])('rejects invalid upload target %s before requesting a ticket', async target => {
    await expect(upload(target)).rejects.toThrow();
    expect(requestTicket).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it.each([{}, { password: 'ticket' }, { addr: 'node.example:24444' }])('rejects incomplete tickets %j before creating a file stream', async ticket => {
    requestTicket.mockResolvedValueOnce(ticket);
    await expect(upload()).rejects.toThrow('incomplete upload ticket');
    expect(fs.createReadStream).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it.each(['ftp://node.example', 'https://user:password@node.example', 'https://node.example/path'])('rejects invalid daemon address %s', async daemonAddress => {
    await expect(upload('/mod.jar', { daemonAddress })).rejects.toThrow();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('propagates ticket request failures without attempting a direct upload', async () => {
    requestTicket.mockRejectedValueOnce(new Error('panel unavailable'));
    await expect(upload()).rejects.toThrow('panel unavailable');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('reports daemon HTTP failures without echoing response or ticket secrets', async () => {
    vi.mocked(axios.post).mockRejectedValueOnce({ response: { status: 403, data: 'secret response' } });
    await expect(upload()).rejects.toThrow('Direct daemon upload failed (HTTP 403); verify the daemon address is reachable from this machine');
  });

  it('reports transport failures without assuming an HTTP response', async () => {
    vi.mocked(axios.post).mockRejectedValueOnce(new Error('secret connection details'));
    await expect(upload()).rejects.toThrow('Direct daemon upload failed; verify the daemon address is reachable from this machine');
  });
});

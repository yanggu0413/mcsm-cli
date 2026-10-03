import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { fileURLToPath } from 'node:url';
import { MCSMClient } from '../src/client/mcsmClient.js';

vi.mock('axios');

describe('MCSMClient', () => {
  const fakeAxiosInstance = {
    interceptors: {
      request: {
        use: vi.fn(),
      },
    },
    request: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (axios.create as any).mockReturnValue(fakeAxiosInstance);
  });

  it('initializes with default headers and base URL', () => {
    new MCSMClient({
      baseUrl: 'http://mcsm.example.com:23333/',
      apiKey: 'test-key-123',
    });

    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://mcsm.example.com:23333',
        headers: expect.objectContaining({
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json; charset=utf-8',
        }),
      })
    );
  });

  it('attaches apikey to request query in interceptor', () => {
    new MCSMClient({
      baseUrl: 'http://localhost:23333',
      apiKey: 'secret-api-key',
    });

    const interceptorFn = fakeAxiosInstance.interceptors.request.use.mock.calls[0][0];
    const dummyReqConfig: any = { params: { custom: 'value' } };
    const result = interceptorFn(dummyReqConfig);

    expect(result.params).toEqual({
      custom: 'value',
      apikey: 'secret-api-key',
    });
  });

  it('unwraps successful standard response { status: 200, data }', async () => {
    fakeAxiosInstance.request.mockResolvedValueOnce({
      data: {
        status: 200,
        data: { instanceUuid: 'inst-1', nickname: 'Minecraft Server' },
        time: 12345678,
      },
    });

    const client = new MCSMClient({
      baseUrl: 'http://localhost:23333',
      apiKey: 'key',
    });

    const data = await client.get('/api/instance', { uuid: 'inst-1' });
    expect(data).toEqual({ instanceUuid: 'inst-1', nickname: 'Minecraft Server' });
  });

  it('requests a one-time upload ticket and streams a multipart file directly to the daemon', async () => {
    fakeAxiosInstance.request.mockResolvedValueOnce({
      data: {
        status: 200,
        data: {
          password: 'one-time-ticket',
          addr: 'localhost:24444',
          remoteMappings: [],
        },
      },
    });
    vi.mocked(axios.post).mockResolvedValueOnce({ data: 'OK' } as any);

    const client = new MCSMClient({
      baseUrl: 'https://panel.example.com:23333',
      apiKey: 'secret-panel-key',
    });
    const localFile = fileURLToPath(import.meta.url);

    await expect(
      client.uploadFile('daemon-1', 'instance-1', localFile, '/plugins/renamed.zip', {
        unzip: true,
        code: 'gbk',
        keepExisting: true,
        daemonAddress: 'http://100.92.190.117:24444',
      })
    ).resolves.toBe('OK');

    expect(fakeAxiosInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/api/files/upload',
        params: {
          daemonId: 'daemon-1',
          uuid: 'instance-1',
          upload_dir: '/plugins',
        },
      })
    );

    const [uploadUrl, form, requestOptions] = vi.mocked(axios.post).mock.calls[0] as any;
    const parsedUrl = new URL(uploadUrl);
    expect(parsedUrl.origin).toBe('http://100.92.190.117:24444');
    expect(parsedUrl.pathname).toBe('/upload/one-time-ticket');
    expect(parsedUrl.searchParams.get('unzip')).toBe('true');
    expect(parsedUrl.searchParams.get('code')).toBe('gbk');
    expect(parsedUrl.searchParams.get('overwrite')).toBe('false');
    expect(uploadUrl).not.toContain('secret-panel-key');
    expect(form.getHeaders()['content-type']).toMatch(/^multipart\/form-data; boundary=/);
    expect(requestOptions).toEqual(
      expect.objectContaining({
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        maxRedirects: 0,
      })
    );
  });

  it('rejects a missing local upload file before requesting a ticket', async () => {
    const client = new MCSMClient({
      baseUrl: 'http://localhost:23333',
      apiKey: 'key',
    });

    await expect(
      client.uploadFile('daemon-1', 'instance-1', './missing-upload-file.zip', '/plugins/file.zip')
    ).rejects.toThrow();
    expect(fakeAxiosInstance.request).not.toHaveBeenCalled();
  });

  it('throws descriptive error on API status 403', async () => {
    fakeAxiosInstance.request.mockResolvedValueOnce({
      data: {
        status: 403,
        data: 'Access denied for this instance',
        time: 12345678,
      },
    });

    const client = new MCSMClient({
      baseUrl: 'http://localhost:23333',
      apiKey: 'key',
    });

    await expect(client.get('/api/instance')).rejects.toThrow(
      'Forbidden / Insufficient Permissions (403): Access denied for this instance'
    );
  });

  it('throws descriptive error on API status 400', async () => {
    fakeAxiosInstance.request.mockResolvedValueOnce({
      data: {
        status: 400,
        data: 'Missing required parameter daemonId',
        time: 12345678,
      },
    });

    const client = new MCSMClient({
      baseUrl: 'http://localhost:23333',
      apiKey: 'key',
    });

    await expect(client.get('/api/service/remote_service_instances')).rejects.toThrow(
      'Invalid Parameters (400): Missing required parameter daemonId'
    );
  });
});

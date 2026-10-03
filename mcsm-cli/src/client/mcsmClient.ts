import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import FormData from 'form-data';
import { IMCSMResponse } from './types.js';

export interface MCSMUploadOptions {
  unzip?: boolean;
  code?: string;
  keepExisting?: boolean;
  daemonAddress?: string;
}

export interface MCSMClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

export class MCSMClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;

  constructor(config: MCSMClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey.trim();

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout ?? 15000,
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json; charset=utf-8',
      },
    });

    // Request interceptor to attach apikey to every request URL query
    this.client.interceptors.request.use((reqConfig) => {
      reqConfig.params = {
        ...(reqConfig.params || {}),
        apikey: this.apiKey,
      };
      return reqConfig;
    });
  }

  public async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.request<IMCSMResponse<T>>(config);
      const resData = response.data;

      // Handle standard MCSManager envelope { status, data, time }
      if (resData && typeof resData === 'object' && 'status' in resData) {
        if (resData.status === 200) {
          return resData.data;
        }

        const msg = typeof resData.data === 'string' ? resData.data : JSON.stringify(resData.data);
        const statusMap: Record<number, string> = {
          400: 'Invalid Parameters (400)',
          403: 'Forbidden / Insufficient Permissions (403)',
          500: 'Server Error (500)',
        };
        const errorDesc = statusMap[resData.status] || `API Error (${resData.status})`;
        throw new Error(`[MCSManager] ${errorDesc}: ${msg}`);
      }

      // If daemon or endpoint returned non-standard format directly
      return response.data as unknown as T;
    } catch (err: any) {
      if (err.response) {
        const data = err.response.data;
        let msg: string;
        if (typeof data === 'string') {
          msg = data;
        } else if (data && typeof data === 'object') {
          if ('data' in data) {
            msg = typeof data.data === 'string' ? data.data : JSON.stringify(data.data);
          } else if ('message' in data) {
            msg = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
          } else {
            msg = JSON.stringify(data);
          }
        } else {
          msg = err.message;
        }
        throw new Error(`[MCSManager HTTP ${err.response.status}] ${msg}`);
      }
      throw err;
    }
  }

  public async uploadFile(
    daemonId: string,
    uuid: string,
    localPath: string,
    remotePath: string,
    options: MCSMUploadOptions = {}
  ): Promise<string> {
    const filePath = path.resolve(localPath);
    const fileStat = fs.statSync(filePath);
    if (!fileStat.isFile()) {
      throw new Error(`Upload source is not a file: ${localPath}`);
    }

    const targetPath = remotePath.replace(/\\/g, '/');
    const targetSegments = targetPath.split('/');
    if (targetSegments.includes('..')) {
      throw new Error(`Invalid upload path: "${remotePath}" contains directory traversal`);
    }
    const normalizedTarget = path.posix.normalize(targetPath);
    if (!normalizedTarget.startsWith('/') || normalizedTarget === '/') {
      throw new Error('Upload target must be a file path inside the instance directory');
    }

    const ticket = await this.get<{
      password?: string;
      addr?: string;
      remoteMappings?: unknown;
    }>('/api/files/upload', {
      daemonId,
      uuid,
      upload_dir: path.posix.dirname(normalizedTarget),
    });

    const daemonAddress = options.daemonAddress || ticket?.addr;
    if (!ticket?.password || !daemonAddress) {
      throw new Error('Panel returned an incomplete upload ticket (missing password or daemon address)');
    }

    const panelProtocol = new URL(this.baseUrl).protocol;
    const daemonBase = daemonAddress.includes('://')
      ? new URL(daemonAddress)
      : new URL(`${panelProtocol}//${daemonAddress}`);
    if (daemonBase.protocol !== 'http:' && daemonBase.protocol !== 'https:') {
      throw new Error(`Unsupported daemon protocol for upload: ${daemonBase.protocol}`);
    }
    if (daemonBase.username || daemonBase.password || daemonBase.pathname !== '/') {
      throw new Error('Panel returned an invalid daemon upload address');
    }

    const uploadUrl = new URL(`/upload/${encodeURIComponent(ticket.password)}`, daemonBase);
    if (options.unzip) uploadUrl.searchParams.set('unzip', 'true');
    if (options.code) uploadUrl.searchParams.set('code', options.code);
    if (options.keepExisting) uploadUrl.searchParams.set('overwrite', 'false');

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), {
      filename: path.posix.basename(normalizedTarget),
      knownLength: fileStat.size,
    });

    try {
      const response = await axios.post<string>(uploadUrl.toString(), form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        maxRedirects: 0,
      });
      return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    } catch (error: any) {
      const status = error?.response?.status;
      const statusText = status ? ` (HTTP ${status})` : '';
      throw new Error(`Direct daemon upload failed${statusText}; verify the daemon address is reachable from this machine`);
    }
  }

  public get<T = any>(path: string, params?: Record<string, any>): Promise<T> {
    return this.request<T>({
      method: 'GET',
      url: path,
      params,
    });
  }

  public post<T = any>(path: string, data?: any, params?: Record<string, any>): Promise<T> {
    return this.request<T>({
      method: 'POST',
      url: path,
      data,
      params,
    });
  }

  public put<T = any>(path: string, data?: any, params?: Record<string, any>): Promise<T> {
    return this.request<T>({
      method: 'PUT',
      url: path,
      data,
      params,
    });
  }

  public delete<T = any>(path: string, data?: any, params?: Record<string, any>): Promise<T> {
    return this.request<T>({
      method: 'DELETE',
      url: path,
      data,
      params,
    });
  }
}

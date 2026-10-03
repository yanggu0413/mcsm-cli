import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type { IMCSMResponse } from './types.js';
import { uploadFile, type MCSMUploadOptions } from './upload.js';

export type { MCSMUploadOptions } from './upload.js';

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
    return uploadFile(
      this.baseUrl,
      params => this.get('/api/files/upload', params),
      daemonId,
      uuid,
      localPath,
      remotePath,
      options,
    );
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

import { maskApiKey } from '../config.js';

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

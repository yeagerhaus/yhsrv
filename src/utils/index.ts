import { randomUUID } from 'crypto';

export function generateId(): string {
  return randomUUID();
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}


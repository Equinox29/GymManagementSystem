import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root, '.env') });
export const database = process.env.MYSQL_DATABASE || 'gym_management';
if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error('Invalid database name');
export const sqlDatabase = `\`${database}\``;
export function connectionConfig(extra = {}) {
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database,
    decimalNumbers: true,
    ...extra
  };
}

import { root, connectionConfig, sqlDatabase } from './config.js';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { migrate } from '../src/database/migrate.js';

const envPath = path.join(root, '.env');
const adminPath = path.join(root, '.env.database-admin');
let env = await readFile(envPath, 'utf8');
let admin;
try {
  admin = dotenv.parse(await readFile(adminPath));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  if (process.env.MYSQL_USER === 'gym_app')
    throw new Error('The database administrator login is missing. Restore .env.database-admin before setup.');
  admin = { MYSQL_USER: process.env.MYSQL_USER || 'root', MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || '' };
  await writeFile(adminPath, Object.entries(admin).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { flag: 'wx' });
}
function setEnv(key, value) {
  const line = `${key}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  env = pattern.test(env) ? env.replace(pattern, line) : `${env.trimEnd()}\n${line}\n`;
  process.env[key] = value;
}
const config = connectionConfig({ user: admin.MYSQL_USER, password: admin.MYSQL_PASSWORD, multipleStatements: true });
const connection = await mysql.createConnection({ ...config, database: undefined });
try {
  const [[version]] = await connection.query('SELECT VERSION() AS version');
  if (!/^8\./.test(version.version)) throw new Error('MySQL 8 is required.');
  const [exists] = await connection.execute('SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [config.database]);
  if (exists.length) {
    const backupDir = path.join(root, '.local-backups');
    await mkdir(backupDir, { recursive: true });
    const backup = path.join(backupDir, `before-migration-${Date.now()}.sql`);
    const dump = process.env.MYSQLDUMP_PATH || 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysqldump.exe';
    await new Promise((resolve, reject) => {
      const child = spawn(dump, [
        '--host', config.host, '--port', String(config.port), '--user', config.user,
        '--single-transaction', '--no-tablespaces', '--set-gtid-purged=OFF',
        `--result-file=${backup}`, config.database
      ], { windowsHide: true, env: { ...process.env, MYSQL_PWD: config.password }, stdio: ['ignore', 'ignore', 'pipe'] });
      let detail = '';
      child.stderr.on('data', (chunk) => { detail += chunk; });
      child.on('error', reject);
      child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Backup failed: ${detail}`)));
    });
    if ((await stat(backup)).size < 1000) throw new Error('Backup is unexpectedly small. Setup stopped.');
    console.log(`Backup saved: ${backup}`);
  }
  if (!process.env.FIELD_ENCRYPTION_KEY) {
    setEnv('FIELD_ENCRYPTION_KEY', randomBytes(32).toString('hex'));
    await writeFile(envPath, env);
  }
  const schema = (await readFile(path.join(root, 'server/src/database/schema.sql'), 'utf8'))
    .replaceAll('`gym_management`', sqlDatabase);
  await connection.query(schema);
  await connection.query(`USE ${sqlDatabase}`);
  await migrate(connection);
  await connection.query("CREATE ROLE IF NOT EXISTS 'gym_runtime_role'@'localhost'");
  for (const table of [
    'users', 'members', 'membership_plans', 'memberships', 'equipment_plans',
    'equipment_subscriptions', 'payments', 'gym_settings', 'attendance',
    'inventory_items', 'inventory_transactions', 'equipment', 'maintenance_logs'
  ]) {
    await connection.query(`GRANT SELECT,INSERT,UPDATE ON ${sqlDatabase}.${table} TO 'gym_runtime_role'@'localhost'`);
  }
  for (const table of ['users', 'inventory_transactions'])
    await connection.query(`REVOKE UPDATE ON ${sqlDatabase}.${table} FROM 'gym_runtime_role'@'localhost'`);
  const appPassword = process.env.APP_DB_PASSWORD ||
    (process.env.MYSQL_USER === 'gym_app' ? process.env.MYSQL_PASSWORD : randomBytes(24).toString('hex'));
  setEnv('APP_DB_PASSWORD', appPassword);
  await connection.query(`CREATE USER IF NOT EXISTS 'gym_app'@'localhost' IDENTIFIED BY ${connection.escape(appPassword)}`);
  await connection.query(`ALTER USER 'gym_app'@'localhost' IDENTIFIED BY ${connection.escape(appPassword)}`);
  await connection.query("GRANT 'gym_runtime_role'@'localhost' TO 'gym_app'@'localhost'");
  await connection.query("SET DEFAULT ROLE 'gym_runtime_role'@'localhost' TO 'gym_app'@'localhost'");
  const runtime = await mysql.createConnection(connectionConfig({ user: 'gym_app', password: appPassword }));
  try { await runtime.query('SELECT id FROM members LIMIT 1'); } finally { await runtime.end(); }
  setEnv('MYSQL_USER', 'gym_app');
  setEnv('MYSQL_PASSWORD', appPassword);
  setEnv('MYSQL_BOOTSTRAP', 'false');
  await writeFile(envPath, env);
  console.log(`MySQL setup complete for ${config.database}. The app uses the limited gym_app account.`);
} finally {
  await connection.end();
}

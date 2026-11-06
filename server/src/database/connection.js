import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let pool;

// Connect the server to MySQL. The API checks each person's permissions.
export const connectDB = async () => {
  const databaseName = process.env.MYSQL_DATABASE || 'gym_management';
  // Allow only safe characters because this name is inserted into SQL.
  if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
    throw new Error('MYSQL_DATABASE may contain only letters, digits, and underscores');
  }
  const config = {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    // Read the database password from the private .env file.
    password: process.env.MYSQL_PASSWORD || '',
    // Allow the setup file to run several SQL commands.
    multipleStatements: true,
    connectTimeout: 8000
  };
  if (process.env.MYSQL_BOOTSTRAP === 'true') {
    const setup = await mysql.createConnection(config);
    try {
      // Use the database name from your settings.
      const schema = (
        await readFile(path.join(serverRoot, 'src/database/schema.sql'), 'utf8')
      ).replaceAll('`gym_management`', `\`${databaseName}\``);
      // Create missing tables. These setup commands cannot be rolled back together.
      await setup.query(schema);
    } finally {
      // Close this connection even if setup fails.
      await setup.end();
    }
  }
  // Keep connections ready to reuse for later requests.
  pool = mysql.createPool({
    ...config,
    database: databaseName,
    // Allow only one SQL command per app query.
    multipleStatements: false,
    waitForConnections: true,
    connectionLimit: 10, // Use up to 10 connections; other requests wait.
    decimalNumbers: true,
    dateStrings: false
  });
  await pool.query('SELECT 1'); // Check that MySQL responds.
  console.log(`MySQL connected at ${config.host}:${config.port}/${databaseName}`);
  return pool;
};

export const db = () => {
  if (!pool) throw new Error('MySQL has not been connected yet');
  return pool;
};

export const closeDB = async () => {
  if (!pool) return;
  await pool.end();
  pool = undefined;
};

// Save related changes together, or undo them all if one fails.
export const transaction = async (work) => {
  // Use one connection for every step in this transaction.
  const connection = await db().getConnection();
  try {
    // Start a transaction; its changes are not permanent yet.
    await connection.beginTransaction();
    const result = await work(connection);
    // Save all changes after every step succeeds.
    await connection.commit();
    return result;
  } catch (error) {
    // Undo the unfinished changes when a step fails.
    await connection.rollback();
    throw error;
  } finally {
    // Let another request use this connection.
    connection.release();
  }
};

export const insertId = (result) => String(result.insertId);
export const hasId = (value) => /^\d+$/.test(String(value ?? ''));
export const record = (row) =>
  row ? { ...row, _id: String(row._id ?? row.id), id: String(row._id ?? row.id) } : null;
export const records = (rows) => rows.map(record);
export const parseJson = (value) => {
  if (value == null || typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

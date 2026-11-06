import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDB, closeDB } from './database/connection.js';
import { seedDatabase } from './seed.js';
import { encryptionKey } from './services/fieldEncryption.js';
import { createApp } from './app.js';
import { expireSuspensions } from './services/attendance.js';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(projectRoot, '.env') });
const init = async () => {
  if (!process.env.JWT_SECRET)
    throw new Error(
      'JWT_SECRET is required. Start the app from the project root with npm run dev.'
    );
  encryptionKey();
  await connectDB();
  await seedDatabase();
  const app = createApp(),
    port = Number(process.env.PORT || 5000);
  const sweep = setInterval(() => {
    expireSuspensions().catch((e) => console.error('Suspension sweep failed:', e.message));
  }, 15000);
  sweep.unref?.();
  const server = app.listen(port, '127.0.0.1', () =>
    console.log(`API running at http://127.0.0.1:${port}`)
  );
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(sweep);
    server.close(async () => {
      await closeDB();
      process.exit(0);
    });
    server.closeAllConnections();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
};
init().catch(async (error) => {
  console.error(
    'Initialization error:',
    error.code === 'ER_ACCESS_DENIED_ERROR'
      ? 'MySQL rejected the configured user/password. Set MYSQL_USER and MYSQL_PASSWORD in the project .env file.'
      : error.message
  );
  await closeDB().catch(() => {});
  process.exit(1);
});

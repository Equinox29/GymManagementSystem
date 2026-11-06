import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(projectRoot, '.env');
try {
  await access(envPath);
} catch {
  console.error('Missing .env. Copy .env.example, enter MySQL credentials, and run npm run db:setup.');
  process.exit(1);
}

const children = [];
let shuttingDown = false;
const stopChildren = (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(exitCode), 300);
};

const start = (label, args, cwd) => {
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', env: process.env });
  children.push(child);
  child.on('error', (error) => {
    console.error(`${label} failed to start:`, error.message);
    stopChildren(1);
  });
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.log(`${label} stopped${code == null ? '' : ` (exit ${code})`}`);
      stopChildren(code || 0);
    }
  });
};

start('API', ['--watch', 'src/index.js'], path.join(projectRoot, 'server'));
start(
  'Web client',
  [path.join(projectRoot, 'client', 'node_modules', 'vite', 'bin', 'vite.js')],
  path.join(projectRoot, 'client')
);

process.once('SIGINT', () => stopChildren(0));
process.once('SIGTERM', () => stopChildren(0));

console.log('Open http://localhost:5173 after both local services finish starting.');

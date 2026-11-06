import { root, connectionConfig } from './config.js';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { connectDB, closeDB, db } from '../src/database/connection.js';
import { migrate } from '../src/database/migrate.js';
import { createApp } from '../src/app.js';

// Run API checks against a disposable copy of the final database, never live records.
const original = process.env.MYSQL_DATABASE;
const suffix = randomBytes(5).toString('hex');
const temporary = `gym_verify_${suffix}`;
const dump = path.join(root, '.local-backups', `verify-${suffix}.sql`);
const admin = dotenv.parse(await readFile(path.join(root, '.env.database-admin')));
const config = connectionConfig({ user: admin.MYSQL_USER, password: admin.MYSQL_PASSWORD });
const adminConnection = await mysql.createConnection({ ...config, database: undefined });
const binary = 'C:/Program Files/MySQL/MySQL Server 8.4/bin';
let server;

function run(file, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      windowsHide: true,
      env: { ...process.env, MYSQL_PWD: config.password },
      stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe']
    });
    let diagnostics = '';
    child.stderr.on('data', (chunk) => { diagnostics += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(diagnostics)));
    if (input) createReadStream(input).pipe(child.stdin);
  });
}

try {
  assert.equal(original, 'gym_management', 'Verification only runs when the final database is active.');
  await run(path.join(binary, 'mysqldump.exe'), [
    '--host', config.host, '--port', String(config.port), '--user', config.user,
    '--single-transaction', '--no-tablespaces', '--set-gtid-purged=OFF',
    `--result-file=${dump}`, original
  ]);
  await adminConnection.query(`CREATE DATABASE \`${temporary}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  await run(path.join(binary, 'mysql.exe'), [
    '--host', config.host, '--port', String(config.port), '--user', config.user,
    '--database', temporary
  ], dump);
  process.env.MYSQL_DATABASE = temporary;
  process.env.MYSQL_USER = admin.MYSQL_USER;
  process.env.MYSQL_PASSWORD = admin.MYSQL_PASSWORD;
  process.env.MYSQL_BOOTSTRAP = 'false';
  await connectDB();
  const migrationConnection = await db().getConnection();
  try { await migrate(migrationConnection); } finally { migrationConnection.release(); }
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const [[adminUser]] = await db().query("SELECT id FROM users WHERE role='admin' LIMIT 1");
  const adminToken = jwt.sign({ id: String(adminUser.id) }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const call = async (route, token, method = 'GET', body) => {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await call('/health', adminToken)).status, 200);
  const [[occupancy]] = await db().query('SELECT COUNT(*) AS total FROM attendance WHERE check_out IS NULL');
  const settings = await call('/settings/attendance', adminToken, 'PUT', {
    memberVisitLimitMinutes: 60, maxCapacity: occupancy.total + 1
  });
  assert.equal(settings.status, 200, JSON.stringify(settings.body));
  const [[plan]] = await db().query("SELECT id FROM equipment_plans WHERE name='Daily Plan'");
  const hash = await bcrypt.hash('TemporaryPass123!', 10);
  const candidates = [];
  for (const index of [1, 2]) {
    const email = `verify-${suffix}-${index}@example.test`;
    const [user] = await db().execute("INSERT INTO users(username,email,password,role) VALUES(?,?,?,'member')", [email, email, hash]);
    const [member] = await db().execute(
      "INSERT INTO members(user_id,first_name,last_name,age,email,status) VALUES(?,'Verify',?,25,?,'active')",
      [user.insertId, String(index), email]
    );
    await db().execute(
      "INSERT INTO equipment_subscriptions(member_id,plan_id,start_date,end_date,status) VALUES(?,?,DATE_SUB(NOW(),INTERVAL 1 DAY),DATE_ADD(NOW(),INTERVAL 1 DAY),'active')",
      [member.insertId, plan.id]
    );
    candidates.push({ memberId: String(member.insertId), userId: String(user.insertId), email });
  }
  const attempts = await Promise.all(candidates.map((candidate) => call(
    '/attendance/checkin', adminToken, 'POST', { memberId: candidate.memberId, visitLimitMinutes: 15 }
  )));
  assert.deepEqual(attempts.map((result) => result.status).sort(), [201, 409]);
  const winnerIndex = attempts.findIndex((result) => result.status === 201);
  const winner = candidates[winnerIndex];
  const other = candidates[1 - winnerIndex];
  const visitId = attempts[winnerIndex].body._id;
  const otherToken = jwt.sign({ id: other.userId }, process.env.JWT_SECRET, { expiresIn: '5m' });
  assert.equal((await call('/member/checkin', otherToken, 'POST')).status, 409,
    'Member self check-in must respect the same capacity limit.');
  const [[afterCheckIn]] = await db().query('SELECT COUNT(*) AS total FROM attendance WHERE check_out IS NULL');
  assert.equal(afterCheckIn.total, occupancy.total + 1);
  await db().execute('UPDATE attendance SET check_in=DATE_SUB(NOW(),INTERVAL 2 HOUR) WHERE id=?', [visitId]);
  const alerts = await call('/attendance/alerts/time-limits', adminToken);
  assert.equal(alerts.status, 200);
  assert.ok(alerts.body.some((alert) => alert._id === visitId && !alert.checkOut));
  const [[staffUser]] = await db().query("SELECT id FROM users WHERE role='staff' LIMIT 1");
  const staffToken = jwt.sign({ id: String(staffUser.id) }, process.env.JWT_SECRET, { expiresIn: '5m' });
  assert.equal((await call('/attendance/alerts/time-limits', staffToken)).status, 200);
  assert.equal((await call(`/attendance/alerts/time-limits/${visitId}/review`, staffToken, 'POST', {
    action: 'dismiss'
  })).status, 403);
  const review = await call(`/attendance/alerts/time-limits/${visitId}/review`, adminToken, 'POST', {
    action: 'suspend', durationHours: 1, reason: 'Integration test overstay'
  });
  assert.equal(review.status, 200, JSON.stringify(review.body));
  assert.ok(!(await call('/attendance/alerts/time-limits', adminToken)).body.some((alert) => alert._id === visitId));
  const [[openVisit]] = await db().execute('SELECT check_out FROM attendance WHERE id=?', [visitId]);
  assert.equal(openVisit.check_out, null, 'Suspension must not check the member out.');
  const memberToken = jwt.sign({ id: winner.userId }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const checkedOut = await call('/member/checkout', memberToken, 'POST');
  assert.equal(checkedOut.status, 200, JSON.stringify(checkedOut.body));
  assert.equal((await call('/member/checkin', otherToken, 'POST')).status, 201,
    'A member can check in after capacity opens.');
  const portal = await call('/member/me', memberToken);
  assert.equal(portal.status, 200);
  assert.ok(portal.body.recentAttendance.some((visit) => visit._id === visitId && visit.checkOut));
  const [[accountPlan]] = await db().query('SELECT id,price FROM membership_plans WHERE is_active=1 LIMIT 1');
  const [[gymPlan]] = await db().query('SELECT id,price FROM equipment_plans WHERE is_active=1 LIMIT 1');
  const checkoutBody = {
    memberId: other.memberId, membershipPlanId: String(accountPlan.id),
    gymPlanId: String(gymPlan.id), amount: Number(accountPlan.price) + Number(gymPlan.price),
    paymentMethod: 'cash'
  };
  const firstSale = await call('/payments/checkout', staffToken, 'POST', checkoutBody);
  assert.equal(firstSale.status, 201, JSON.stringify(firstSale.body));
  assert.equal(firstSale.body.purchaseType, 'bundle');
  const secondSale = await call('/payments/checkout', staffToken, 'POST', checkoutBody);
  assert.equal(secondSale.status, 201, JSON.stringify(secondSale.body));
  assert.equal(new Date(secondSale.body.membership.startDate).getTime(), new Date(firstSale.body.membership.endDate).getTime(), 'Account renewal must follow the prior term.');
  assert.equal(new Date(secondSale.body.gymPlan.startDate).getTime(), new Date(firstSale.body.gymPlan.endDate).getTime(), 'Gym renewal must follow the prior term.');
  const planStatus = await call(`/payments/member/${other.memberId}/plan-status`, adminToken);
  assert.equal(planStatus.status, 200, JSON.stringify(planStatus.body));
  assert.ok(planStatus.body.accountPlans.some((plan) => plan.state === 'scheduled'));
  assert.ok(planStatus.body.gymPlans.some((plan) => plan.state === 'scheduled'));
  const [[receiptCount]] = await db().execute('SELECT COUNT(*) AS n FROM payments WHERE id IN (?,?) AND purchase_type=?', [firstSale.body.paymentId, secondSale.body.paymentId, 'bundle']);
  assert.equal(receiptCount.n, 2, 'Each bundled checkout should create one receipt.');
  const beforeInventory = await call('/dashboard', adminToken);
  const item = await call('/inventory', adminToken, 'POST', {
    name: `Verify item ${suffix}`, category: 'drink', quantity: 2,
    unitPrice: 25, reorderLevel: 1
  });
  assert.equal(item.status, 201, JSON.stringify(item.body));
  assert.equal((await call(`/inventory/${item.body._id}/restock`, adminToken, 'POST', { quantity: 1 })).status, 200);
  assert.equal((await call(`/inventory/${item.body._id}/sell`, staffToken, 'POST', { quantity: 1 })).status, 200);
  const afterInventory = await call('/dashboard', adminToken);
  assert.equal(Number(afterInventory.body.monthlyInventoryRevenue) - Number(beforeInventory.body.monthlyInventoryRevenue), 25);
  assert.equal(Number(afterInventory.body.monthlyRevenue) - Number(beforeInventory.body.monthlyRevenue), 25);
  assert.equal((await call(`/inventory/${item.body._id}`, adminToken, 'DELETE')).status, 200);
  const movement = await call(`/inventory/transactions?itemId=${item.body._id}`, adminToken);
  assert.equal(movement.status, 200, JSON.stringify(movement.body));
  assert.deepEqual(movement.body.map(entry => entry.type), ['archive', 'sale', 'restock', 'restock']);
  const salePage = await call(`/inventory/transactions?itemId=${item.body._id}&type=sale&limit=1&offset=0`, adminToken);
  assert.equal(salePage.status, 200, JSON.stringify(salePage.body));
  assert.deepEqual(salePage.body.map(entry => entry.type), ['sale']);
  assert.deepEqual((await call(`/inventory/transactions?itemId=${item.body._id}&limit=2&offset=2`, adminToken)).body.map(entry => entry.type), ['restock', 'restock']);
  const salesReport = await call(`/inventory/sales?itemId=${item.body._id}&limit=1`, staffToken);
  assert.equal(salesReport.status, 200, JSON.stringify(salesReport.body));
  assert.equal(salesReport.body.summary.saleCount, 1);
  assert.equal(Number(salesReport.body.summary.revenue), 25);
  assert.equal(salesReport.body.sales[0].itemName, `Verify item ${suffix}`);
  assert.equal((await call(`/inventory/sales?search=Verify%20item%20${suffix}`, staffToken)).body.summary.saleCount, 1);
  assert.equal((await call('/inventory/sales?search=no-such-product', staffToken)).body.summary.saleCount, 0);
  assert.equal((await call('/inventory/sales?from=2026-02-30', staffToken)).status, 400);
  const emptyItem = await call('/inventory', adminToken, 'POST', {
    name: `Empty item ${suffix}`, category: 'other', quantity: 0,
    unitPrice: 1, reorderLevel: 0
  });
  assert.equal(emptyItem.status, 201, JSON.stringify(emptyItem.body));
  assert.equal((await call(`/inventory/${emptyItem.body._id}`, adminToken, 'DELETE')).status, 200);
  const emptyMovement = await call(`/inventory/transactions?itemId=${emptyItem.body._id}`, adminToken);
  assert.equal(emptyMovement.body[0].type, 'archive');
  assert.equal(emptyMovement.body[0].quantity, 0);
  const equipment = await call('/equipment', adminToken, 'POST', {
    name: `Verify equipment ${suffix}`, category: 'Cardio', condition: 'under_maintenance'
  });
  assert.equal(equipment.status, 201, JSON.stringify(equipment.body));
  const ticket = await call(`/equipment/${equipment.body._id}/maintenance`, staffToken, 'POST', {
    type: 'repair', priority: 'high', description: 'Test repair'
  });
  assert.equal(ticket.status, 201, JSON.stringify(ticket.body));
  const ticketId = ticket.body.maintenanceLogs[0]._id;
  const secondTicket = await call(`/equipment/${equipment.body._id}/maintenance`, staffToken, 'POST', {
    type: 'inspection', priority: 'medium', description: 'Follow-up inspection'
  });
  assert.equal(secondTicket.status, 201, JSON.stringify(secondTicket.body));
  const secondTicketId = secondTicket.body.maintenanceLogs.find(log => log._id !== ticketId)._id;
  const resolved = await call(`/equipment/${equipment.body._id}/maintenance/${ticketId}`, staffToken, 'PUT', {
    status: 'resolved'
  });
  assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
  assert.equal(resolved.body.maintenanceLogs.find(log => log._id === ticketId).status, 'resolved');
  assert.ok(resolved.body.maintenanceLogs.find(log => log._id === ticketId).resolvedDate);
  assert.equal(resolved.body.condition, 'under_maintenance', 'Equipment remains in service while another ticket is open.');
  const adminResolved = await call(`/equipment/${equipment.body._id}/maintenance/${secondTicketId}`, adminToken, 'PUT', {
    status: 'resolved'
  });
  assert.equal(adminResolved.status, 200, JSON.stringify(adminResolved.body));
  assert.equal(adminResolved.body.condition, 'operational');
  assert.equal((await call(`/equipment/${equipment.body._id}/maintenance/${ticketId}`, staffToken, 'PUT', {
    condition: 'out_of_order'
  })).status, 403, 'Staff may resolve tickets but cannot edit equipment condition directly.');
  const removed = await call(`/members/${winner.memberId}`, adminToken, 'DELETE');
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.equal((await call('/auth/me', memberToken)).status, 401);
  const directory = await call('/members', adminToken);
  assert.ok(!directory.body.some((member) => member._id === winner.memberId));
  assert.equal((await call('/auth/login', '', 'POST', {
    username: winner.email, password: 'TemporaryPass123!'
  })).status, 401);
  const [[retained]] = await db().execute('SELECT COUNT(*) AS total FROM attendance WHERE member_id=?', [winner.memberId]);
  assert.ok(retained.total > 0, 'Attendance history must remain after removal.');
  console.log('Verified attendance, billing, inventory sales, staff equipment resolution, member history, and login revocation.');
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await closeDB();
  await adminConnection.query(`DROP DATABASE IF EXISTS \`${temporary}\``);
  await adminConnection.end();
  await unlink(dump).catch(() => {});
}

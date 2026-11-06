import bcrypt from 'bcryptjs';
import { db } from './database/connection.js';
export const seedDatabase = async () => {
  const pool = db();
  for (const config of [
    {
      role: 'admin',
      username: process.env.INITIAL_ADMIN_USERNAME || 'admin',
      email: process.env.INITIAL_ADMIN_EMAIL || 'admin@localhost.test',
      password: process.env.INITIAL_ADMIN_PASSWORD
    },
    {
      role: 'staff',
      username: process.env.INITIAL_STAFF_USERNAME || 'staff',
      email: process.env.INITIAL_STAFF_EMAIL || 'staff@localhost.test',
      password: process.env.INITIAL_STAFF_PASSWORD
    }
  ]) {
    const [rows] = await pool.execute('SELECT id FROM users WHERE role=? LIMIT 1', [config.role]);
    if (!rows.length) {
      if (!config.password) throw new Error('Set initial account passwords in .env before setup.');
      await pool.execute('INSERT INTO users(username,email,password,role) VALUES(?,?,?,?)', [
        config.username,
        config.email,
        // Save a password hash, not the original password.
        await bcrypt.hash(config.password, 12),
        config.role
      ]);
      console.log(`Created initial ${config.role} account: ${config.username}`);
    }
  }
  for (const p of [
    {
      name: 'Gym Membership',
      duration: 12,
      price: 500,
      type: 'account_membership',
      features: ['Member account registration', '12-month account membership']
    }
  ]) {
    await pool.execute(
      'INSERT INTO membership_plans(name,duration,price,type,features,is_active) VALUES(?,?,?,?,?,1) ON DUPLICATE KEY UPDATE name=VALUES(name)',
      [p.name, p.duration, p.price, p.type, JSON.stringify(p.features)]
    );
  }
  for (const p of [
    { name: 'Daily Plan', duration: 1, durationUnit: 'day', price: 50 },
    { name: 'Monthly Plan', duration: 1, durationUnit: 'month', price: 700 },
    { name: 'Yearly Plan', duration: 1, durationUnit: 'year', price: 7000 }
  ])
    await pool.execute(
      'INSERT INTO equipment_plans(name,duration,duration_unit,price,is_active) VALUES(?,?,?,?,1) ON DUPLICATE KEY UPDATE name=VALUES(name)',
      [p.name, p.duration, p.durationUnit, p.price]
    );
  console.log('MySQL accounts and plans ready. Existing members and stock preserved.');
};

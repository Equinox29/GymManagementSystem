import express from 'express';
import { db } from '../database/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = express.Router();
router.use(authenticate, authorize('admin', 'staff'));
router.get('/attendance', async (_req, res) => {
  const [rows] = await db().execute(
    "SELECT member_visit_limit_minutes AS memberVisitLimitMinutes,max_capacity AS maxCapacity FROM gym_settings WHERE setting_key='main'"
  );
  const [[occupancy]] = await db().execute('SELECT COUNT(*) AS currentlyIn FROM attendance WHERE check_out IS NULL');
  res.json({ memberVisitLimitMinutes: rows[0]?.memberVisitLimitMinutes || 120, maxCapacity: rows[0]?.maxCapacity || 50, currentlyIn: occupancy.currentlyIn });
});
router.put('/attendance', authorize('admin'), async (req, res) => {
  const minutes = Number(req.body.memberVisitLimitMinutes);
  const capacity = Number(req.body.maxCapacity);
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 480)
    return res.status(400).json({ message: 'Default visit limit must be from 15 to 480 minutes' });
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000)
    return res.status(400).json({ message: 'Gym capacity must be from 1 to 10,000 people' });
  await db().execute(
    "INSERT INTO gym_settings(setting_key,member_visit_limit_minutes,max_capacity) VALUES('main',?,?) ON DUPLICATE KEY UPDATE member_visit_limit_minutes=VALUES(member_visit_limit_minutes),max_capacity=VALUES(max_capacity)",
    [minutes, capacity]
  );
  res.json({ memberVisitLimitMinutes: minutes, maxCapacity: capacity });
});
export default router;

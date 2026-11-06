import express from 'express';
import { db, records, hasId, parseJson, transaction } from '../database/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  checkInWithCapacity,
  expireSuspensions,
  getVisitLimit,
  todayWindow
} from '../services/attendance.js';
const router = express.Router();
router.use(authenticate, authorize('admin', 'staff'));
const attFields = `a.id AS _id,a.member_id AS memberId,a.user_id AS userId,a.check_in AS checkIn,a.check_out AS checkOut,a.visit_limit_minutes AS visitLimitMinutes,a.check_out_reason AS checkOutReason,a.notes,
IF(a.member_id IS NOT NULL,JSON_OBJECT('_id',m.id,'firstName',m.first_name,'lastName',m.last_name,'photoUrl',m.photo_url,'status',m.status),NULL) member_json,
IF(a.user_id IS NOT NULL,JSON_OBJECT('_id',u.id,'username',u.username,'role',u.role),NULL) user_json`;
const shape = (rows) =>
  records(rows).map((a) => ({
    ...a,
    memberId: a.member_json ? parseJson(a.member_json) : null,
    userId: a.user_json ? parseJson(a.user_json) : null
  }));
router.get('/', async (req, res) => {
  await expireSuspensions();
  let date = new Date();
  if (req.query.date) {
    date = new Date(`${req.query.date}T00:00:00`);
    if (Number.isNaN(date.getTime()))
      return res.status(400).json({ message: 'Invalid attendance date' });
  }
  const { start, end } = todayWindow(date);
  const [rows] = await db().execute(
    `SELECT ${attFields} FROM attendance a LEFT JOIN members m ON m.id=a.member_id LEFT JOIN users u ON u.id=a.user_id WHERE (a.check_in>=? AND a.check_in<?) OR a.check_out IS NULL ORDER BY a.check_in DESC`,
    [start, end]
  );
  res.json(shape(rows));
});
router.get('/alerts/time-limits', async (_req, res) => {
  const [rows] = await db().execute(
    "SELECT a.id AS _id,a.member_id AS memberId,a.check_in AS checkIn,a.check_out AS checkOut,a.visit_limit_minutes AS visitLimitMinutes,JSON_OBJECT('_id',m.id,'firstName',m.first_name,'lastName',m.last_name,'status',m.status) member_json FROM attendance a JOIN members m ON m.id=a.member_id WHERE a.overstay_reviewed_at IS NULL AND (a.check_out_reason IS NULL OR a.check_out_reason<>'time_limit') AND COALESCE(a.check_out,NOW())>DATE_ADD(a.check_in, INTERVAL a.visit_limit_minutes MINUTE) ORDER BY a.check_in"
  );
  res.json(records(rows).map((a) => ({ ...a, memberId: parseJson(a.member_json) })));
});
router.post('/alerts/time-limits/:id/review', authorize('admin'), async (req, res) => {
  if (!hasId(req.params.id)) return res.status(400).json({ message: 'Invalid attendance id' });
  const action = req.body?.action;
  const hours = Number(req.body?.durationHours);
  if (!['suspend', 'dismiss'].includes(action)) return res.status(400).json({ message: 'Choose suspend or dismiss.' });
  if (action === 'suspend' && (!Number.isInteger(hours) || hours < 1 || hours > 720))
    return res.status(400).json({ message: 'Suspension must be between 1 hour and 30 days.' });
  try {
    await transaction(async (connection) => {
      const [[visit]] = await connection.execute(
        'SELECT member_id,check_in,check_out,visit_limit_minutes,overstay_reviewed_at,check_out_reason FROM attendance WHERE id=? FOR UPDATE', [req.params.id]
      );
      if (!visit || !visit.member_id) throw Object.assign(new Error('Member visit not found.'), { status: 404 });
      if (visit.overstay_reviewed_at) throw Object.assign(new Error('This overstay has already been reviewed.'), { status: 409 });
      if (visit.check_out_reason === 'time_limit' || new Date(visit.check_out || Date.now()) <= new Date(visit.check_in).getTime() + visit.visit_limit_minutes * 60000)
        throw Object.assign(new Error('This visit did not exceed its limit.'), { status: 409 });
      if (action === 'suspend') {
        const reason = String(req.body?.reason || 'Exceeded gym visit time limit').trim().slice(0, 500);
        const [result] = await connection.execute(
          "UPDATE members SET status='suspended',suspension_until=?,suspension_reason=?,suspended_at=NOW(),suspension_notice_seen_at=NULL WHERE id=? AND status='active' AND deleted_at IS NULL",
          [new Date(Date.now() + hours * 3600000), reason, visit.member_id]
        );
        if (!result.affectedRows) throw Object.assign(new Error('Only an active member can be suspended. You can dismiss this alert after review.'), { status: 409 });
      }
      await connection.execute('UPDATE attendance SET overstay_reviewed_at=NOW() WHERE id=?', [req.params.id]);
    });
    res.json({ message: action === 'suspend' ? 'Member suspended and overstay reviewed.' : 'Overstay reviewed without a suspension.' });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});
router.get('/me', async (req, res) => {
  const [rows] = await db().execute(
    `SELECT ${attFields} FROM attendance a LEFT JOIN members m ON m.id=a.member_id LEFT JOIN users u ON u.id=a.user_id WHERE a.user_id=? AND a.check_out IS NULL ORDER BY a.check_in DESC LIMIT 1`,
    [req.user.id]
  );
  res.json({ activeVisit: shape(rows)[0] || null });
});
router.post('/me/checkin', async (req, res) => {
  try {
    const id = await checkInWithCapacity({ userId: req.user.id });
    const [rows] = await db().execute(
      `SELECT ${attFields} FROM attendance a LEFT JOIN members m ON m.id=a.member_id LEFT JOIN users u ON u.id=a.user_id WHERE a.id=?`,
      [id]
    );
    res.status(201).json(shape(rows)[0]);
  } catch (error) {
    res
      .status(error.status || (error.code === 'ER_DUP_ENTRY' ? 409 : 400))
      .json({
        message:
          error.code === 'ER_DUP_ENTRY' ? 'You are already checked in' : error.message,
        error: error.message
      });
  }
});
router.post('/me/checkout', async (req, res) => {
  const [r] = await db().execute(
    'UPDATE attendance SET check_out=NOW(),check_out_reason=? WHERE user_id=? AND check_out IS NULL',
    [req.user.role, req.user.id]
  );
  if (!r.affectedRows) return res.status(409).json({ message: 'You are not currently checked in' });
  const [rows] = await db().execute(
    `SELECT ${attFields} FROM attendance a LEFT JOIN members m ON m.id=a.member_id LEFT JOIN users u ON u.id=a.user_id WHERE a.user_id=? ORDER BY a.check_in DESC LIMIT 1`,
    [req.user.id]
  );
  res.json(shape(rows)[0]);
});
router.post('/checkin', async (req, res) => {
  try {
    await expireSuspensions();
    const memberId = req.body.memberId;
    if (!hasId(memberId)) return res.status(400).json({ message: 'Invalid member id' });
    const [ms] = await db().execute('SELECT id,status FROM members WHERE id=? AND deleted_at IS NULL', [memberId]);
    if (!ms.length) return res.status(404).json({ message: 'Member not found' });
    if (ms[0].status !== 'active')
      return res
        .status(403)
        .json({ message: `Member is ${ms[0].status}; only active members can check in` });
    const max = Number(req.body.visitLimitMinutes ?? (await getVisitLimit()));
    if (!Number.isInteger(max) || max < 15 || max > 480)
      return res.status(400).json({ message: 'Visit limit must be from 15 to 480 minutes' });
    const [gate] = await db().execute(
        "SELECT id FROM equipment_subscriptions WHERE member_id=? AND status='active' AND start_date<=NOW() AND end_date>=NOW() LIMIT 1",
        [memberId]
      );
    if (!gate.length)
      return res
        .status(403)
        .json({
          message: 'Member needs an active Daily Plan, Monthly Plan, or Yearly Plan to check in.'
        });
    const id = await checkInWithCapacity({ memberId, visitLimitMinutes: max });
    const [rows] = await db().execute(
      `SELECT ${attFields} FROM attendance a JOIN members m ON m.id=a.member_id LEFT JOIN users u ON u.id=a.user_id WHERE a.id=?`,
      [id]
    );
    res.status(201).json(shape(rows)[0]);
  } catch (error) {
    res
      .status(error.status || (error.code === 'ER_DUP_ENTRY' ? 409 : 400))
      .json({
        message:
          error.code === 'ER_DUP_ENTRY'
            ? 'Member is already checked in'
            : error.message,
        error: error.message
      });
  }
});
router.put('/:id/checkout', async (req, res) => {
  if (!hasId(req.params.id)) return res.status(400).json({ message: 'Invalid attendance id' });
  const [r] = await db().execute(
    'UPDATE attendance SET check_out=NOW(),check_out_reason=? WHERE id=? AND check_out IS NULL',
    [req.user.role, req.params.id]
  );
  if (!r.affectedRows) {
    return res.status(404).json({ message: 'Open attendance record not found' });
  }
  const [rows] = await db().execute(
    `SELECT ${attFields} FROM attendance a LEFT JOIN members m ON m.id=a.member_id LEFT JOIN users u ON u.id=a.user_id WHERE a.id=?`,
    [req.params.id]
  );
  res.json(shape(rows)[0]);
});
export default router;

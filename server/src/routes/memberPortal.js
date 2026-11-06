import express from 'express';
import { db, record, records, parseJson } from '../database/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { revealContact } from '../services/fieldEncryption.js';
import {
  checkInWithCapacity,
  expireSuspensions,
  getVisitLimit,
  todayWindow
} from '../services/attendance.js';
const router = express.Router();
router.use(authenticate, authorize('member'));
const memberFor = async (userId) => {
  const [rows] = await db().execute(
    'SELECT id AS _id,id AS id,first_name AS firstName,last_name AS lastName,age,email,phone,status,suspension_until AS suspensionUntil,suspension_reason AS suspensionReason,suspended_at AS suspendedAt,suspension_notice_seen_at AS suspensionNoticeSeenAt,emergency_contact AS emergencyContact,photo_url AS photoUrl,join_date AS joinDate FROM members WHERE user_id=? AND deleted_at IS NULL',
    [userId]
  );
  return revealContact(record(rows[0]));
};
router.get('/me', async (req, res) => {
  try {
    await expireSuspensions();
    const member = await memberFor(req.user.id);
    if (!member)
      return res.status(404).json({ message: 'Member profile is not linked to this account' });
    const { start, end } = todayWindow();
    const [[memberships], [subs], [active], [today], [history], visitLimitMinutes] =
      await Promise.all([
        db().execute(
          "SELECT m.id AS _id,m.member_id AS memberId,m.plan_id AS planId,m.start_date AS startDate,m.end_date AS endDate,m.status,JSON_OBJECT('_id',p.id,'name',p.name,'duration',p.duration,'price',p.price) plan_json FROM memberships m JOIN membership_plans p ON p.id=m.plan_id WHERE m.member_id=? AND m.status='active' AND m.start_date<=NOW() AND m.end_date>=NOW() ORDER BY m.end_date DESC LIMIT 1",
          [member.id]
        ),
        db().execute(
          "SELECT s.id AS _id,s.member_id AS memberId,s.plan_id AS planId,s.start_date AS startDate,s.end_date AS endDate,s.status,JSON_OBJECT('_id',p.id,'name',p.name,'duration',p.duration,'durationUnit',p.duration_unit,'price',p.price) plan_json FROM equipment_subscriptions s JOIN equipment_plans p ON p.id=s.plan_id WHERE s.member_id=? AND s.status='active' AND s.start_date<=NOW() AND s.end_date>=NOW() ORDER BY s.end_date DESC LIMIT 1",
          [member.id]
        ),
        db().execute(
          'SELECT id AS _id,member_id AS memberId,check_in AS checkIn,check_out AS checkOut,visit_limit_minutes AS visitLimitMinutes,check_out_reason AS checkOutReason FROM attendance WHERE member_id=? AND check_out IS NULL LIMIT 1',
          [member.id]
        ),
        db().execute(
          'SELECT id AS _id,member_id AS memberId,check_in AS checkIn,check_out AS checkOut,visit_limit_minutes AS visitLimitMinutes,check_out_reason AS checkOutReason FROM attendance WHERE member_id=? AND check_in>=? AND check_in<? ORDER BY check_in DESC LIMIT 1',
          [member.id, start, end]
        ),
        db().execute(
          'SELECT id AS _id,member_id AS memberId,check_in AS checkIn,check_out AS checkOut,visit_limit_minutes AS visitLimitMinutes,check_out_reason AS checkOutReason FROM attendance WHERE member_id=? ORDER BY check_in DESC LIMIT 10',
          [member.id]
        ),
        getVisitLimit()
      ]);
    const subscription = (r) =>
      r[0] ? { ...record(r[0]), planId: parseJson(r[0].plan_json) } : null;
    res.json({
      member,
      suspensionNoticePending:
        member.status === 'suspended' &&
        (!member.suspensionNoticeSeenAt ||
          !member.suspendedAt ||
          new Date(member.suspensionNoticeSeenAt) < new Date(member.suspendedAt)),
      membership: subscription(memberships),
      gatepass: subscription(subs),
      visitLimitMinutes,
      activeVisit: active[0] ? record(active[0]) : null,
      todayVisit: today[0] ? record(today[0]) : null,
      recentAttendance: records(history)
    });
  } catch (error) {
    res.status(500).json({ message: 'Unable to load member portal', error: error.message });
  }
});
router.post('/suspension-notice/acknowledge', async (req, res) => {
  const member = await memberFor(req.user.id);
  if (!member || member.status !== 'suspended')
    return res.status(404).json({ message: 'No active suspension notice was found.' });
  await db().execute('UPDATE members SET suspension_notice_seen_at=NOW() WHERE id=?', [member.id]);
  res.json({ acknowledged: true });
});
router.post('/checkin', async (req, res) => {
  try {
    await expireSuspensions();
    const member = await memberFor(req.user.id);
    if (!member)
      return res.status(404).json({ message: 'Member profile is not linked to this account' });
    if (member.status !== 'active')
      return res
        .status(403)
        .json({ message: `Your account is ${member.status}. Only active members can check in.` });
    const { start, end } = todayWindow();
    const [[gate], [open], [today]] = await Promise.all([
      db().execute(
        "SELECT id FROM equipment_subscriptions WHERE member_id=? AND status='active' AND start_date<=NOW() AND end_date>=NOW() LIMIT 1",
        [member.id]
      ),
      db().execute('SELECT id FROM attendance WHERE member_id=? AND check_out IS NULL', [
        member.id
      ]),
      db().execute('SELECT id FROM attendance WHERE member_id=? AND check_in>=? AND check_in<?', [
        member.id,
        start,
        end
      ])
    ]);
    if (!gate.length)
      return res.status(403).json({
        message: 'An active Daily Plan, Monthly Plan, or Yearly Plan is required to check in.'
      });
    if (open.length) return res.status(409).json({ message: 'You are already checked in' });
    if (today.length)
      return res.status(409).json({
        message: 'You have already used your one visit today. You can check in again tomorrow.'
      });
    const limit = await getVisitLimit();
    const id = await checkInWithCapacity({ memberId: member.id, visitLimitMinutes: limit });
    const [rows] = await db().execute(
      'SELECT id AS _id,member_id AS memberId,check_in AS checkIn,check_out AS checkOut,visit_limit_minutes AS visitLimitMinutes,check_out_reason AS checkOutReason FROM attendance WHERE id=?',
      [id]
    );
    res.status(201).json(record(rows[0]));
  } catch (error) {
    res
      .status(error.status || (error.code === 'ER_DUP_ENTRY' ? 409 : 400))
      .json({ message: error.message });
  }
});
router.post('/checkout', async (req, res) => {
  const member = await memberFor(req.user.id);
  if (!member)
    return res.status(404).json({ message: 'Member profile is not linked to this account' });
  const [r] = await db().execute(
    "UPDATE attendance SET check_out=NOW(),check_out_reason='member' WHERE member_id=? AND check_out IS NULL",
    [member.id]
  );
  if (!r.affectedRows) return res.status(409).json({ message: 'You are not currently checked in' });
  const [rows] = await db().execute(
    'SELECT id AS _id,member_id AS memberId,check_in AS checkIn,check_out AS checkOut,visit_limit_minutes AS visitLimitMinutes,check_out_reason AS checkOutReason FROM attendance WHERE member_id=? ORDER BY check_in DESC LIMIT 1',
    [member.id]
  );
  res.json(record(rows[0]));
});
export default router;

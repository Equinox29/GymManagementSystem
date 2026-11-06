import express from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { db, records, record, hasId, transaction } from '../database/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { expireSuspensions } from '../services/attendance.js';
import { encryptContact, revealContact } from '../services/fieldEncryption.js';

const router = express.Router();
router.use(authenticate, authorize('admin', 'staff'));
const fields =
  'id AS _id,first_name AS firstName,last_name AS lastName,age,email,phone,status,suspension_until AS suspensionUntil,suspension_reason AS suspensionReason,suspended_at AS suspendedAt,suspension_notice_seen_at AS suspensionNoticeSeenAt,emergency_contact AS emergencyContact,photo_url AS photoUrl,user_id AS userId,join_date AS joinDate,portal_invite_expires_at AS portalInviteExpiresAt,(portal_invite_hash IS NOT NULL AND portal_invite_expires_at>NOW() AND user_id IS NULL AND status=\'active\') AS hasActiveInvite';
router.get('/', async (req, res) => {
  await expireSuspensions();
  let sql = `SELECT ${fields} FROM members WHERE 1=1`,
    params = [];
  sql += ' AND deleted_at IS NULL';
  if (req.query.status) {
    sql += ' AND status=?';
    params.push(req.query.status);
  }
  if (req.query.search) {
    sql += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
    const q = `%${String(req.query.search).trim()}%`;
    params.push(q, q, q);
  }
  sql += ' ORDER BY last_name,first_name';
  const [rows] = await db().execute(sql, params);
  res.json(records(rows).map(revealContact));
});
router.get('/:id', async (req, res) => {
  if (!hasId(req.params.id)) return res.status(400).json({ message: 'Invalid member id' });
  const [members] = await db().execute(`SELECT ${fields} FROM members WHERE id=? AND deleted_at IS NULL`, [req.params.id]);
  if (!members.length) return res.status(404).json({ message: 'Member not found' });
  const [memberships] = await db().execute(
    'SELECT m.id AS _id,m.member_id AS memberId,m.plan_id AS planId,m.start_date AS startDate,m.end_date AS endDate,m.status,m.created_at AS createdAt,p.name AS planName,p.duration AS planDuration,p.price AS planPrice FROM memberships m JOIN membership_plans p ON p.id=m.plan_id WHERE m.member_id=? ORDER BY m.end_date DESC',
    [req.params.id]
  );
  const [attendance] = await db().execute(
    'SELECT id AS _id,member_id AS memberId,check_in AS checkIn,check_out AS checkOut,visit_limit_minutes AS visitLimitMinutes,check_out_reason AS checkOutReason,notes FROM attendance WHERE member_id=? ORDER BY check_in DESC LIMIT 10',
    [req.params.id]
  );
  res.json({
    member: revealContact(record(members[0])),
    memberships: records(memberships).map((x) => ({
      ...x,
      plan: { name: x.planName, duration: x.planDuration, price: x.planPrice }
    })),
    recentAttendance: records(attendance)
  });
});
router.post('/:id/portal-invite', async (req, res) => {
  try {
    if (!hasId(req.params.id)) return res.status(400).json({ message: 'Invalid member id' });
    const code = randomBytes(24).toString('hex'),
      hash = createHash('sha256').update(code).digest('hex'),
      until = new Date(Date.now() + 1800000);
    const [result] = await db().execute(
      "UPDATE members m SET portal_invite_hash=?,portal_invite_expires_at=? WHERE id=? AND deleted_at IS NULL AND status='active' AND user_id IS NULL AND EXISTS(SELECT 1 FROM memberships ms WHERE ms.member_id=m.id AND ms.status='active' AND ms.start_date<=NOW() AND ms.end_date>=NOW())",
      [hash, until, req.params.id]
    );
    if (!result.affectedRows) {
      const [r] = await db().execute('SELECT status,user_id FROM members WHERE id=?', [
        req.params.id
      ]);
      if (!r.length) return res.status(404).json({ message: 'Member not found' });
      if (r[0].user_id)
        return res.status(409).json({ message: 'This member already has a portal account' });
      return res.status(403).json({
        message:
          'An active account membership payment is required before creating the member account invitation.'
      });
    }
    res.status(201).json({ inviteCode: code, expiresAt: until });
  } catch (error) {
    res.status(400).json({ message: 'Unable to create member invitation', error: error.message });
  }
});
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, age, email, phone, emergencyContact, status } = req.body;
    const [r] = await db().execute(
      'INSERT INTO members(first_name,last_name,age,email,phone,emergency_contact,status) VALUES(?,?,?,?,?,?,?)',
      [
        String(firstName || '').trim(),
        String(lastName || '').trim(),
        Number(age),
        String(email || '')
          .trim()
          .toLowerCase(),
        phone || null,
        encryptContact(emergencyContact),
        req.user.role === 'admin' && ['active', 'inactive'].includes(status) ? status : 'active'
      ]
    );
    const [rows] = await db().execute(`SELECT ${fields} FROM members WHERE id=?`, [r.insertId]);
    res.status(201).json(revealContact(record(rows[0])));
  } catch (error) {
    res
      .status(error.code === 'ER_DUP_ENTRY' ? 409 : 400)
      .json({ message: 'Error creating member', error: error.message });
  }
});
router.put('/:id', async (req, res) => {
  if (!hasId(req.params.id)) return res.status(400).json({ message: 'Invalid member id' });
  try {
    const b = req.body,
      allowed = {
        firstName: 'first_name',
        lastName: 'last_name',
        age: 'age',
        email: 'email',
        phone: 'phone',
        emergencyContact: 'emergency_contact'
      },
      keys = Object.keys(allowed).filter((k) => Object.hasOwn(b, k));
    if (req.user.role === 'admin' && ['active', 'inactive'].includes(b.status)) {
      keys.push('status');
      allowed.status = 'status';
    }
    if (!keys.length) return res.status(400).json({ message: 'No member fields to update' });
    const values = keys.map((k) =>
      k === 'emergencyContact'
        ? encryptContact(b[k])
        : k === 'email'
          ? String(b[k]).trim().toLowerCase()
          : b[k]
    );
    let sql = `UPDATE members SET ${keys.map((k) => `${allowed[k]}=?`).join(',')}`;
    if (keys.includes('status'))
      sql +=
        ',suspension_until=NULL,suspension_reason=NULL,suspended_at=NULL,suspension_notice_seen_at=NULL';
    await db().execute(`${sql} WHERE id=? AND deleted_at IS NULL`, [...values, req.params.id]);
    const [rows] = await db().execute(`SELECT ${fields} FROM members WHERE id=? AND deleted_at IS NULL`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Member not found' });
    res.json(revealContact(record(rows[0])));
  } catch (error) {
    res
      .status(error.code === 'ER_DUP_ENTRY' ? 409 : 400)
      .json({ message: 'Error updating member', error: error.message });
  }
});
router.post('/:id/suspend', authorize('admin'), async (req, res) => {
  const hours = Number(req.body?.durationHours);
  if (!Number.isInteger(hours) || hours < 1 || hours > 720)
    return res.status(400).json({ message: 'Suspension must be between 1 hour and 30 days.' });
  const until = new Date(Date.now() + hours * 3600000),
    reason = String(req.body?.reason || '')
      .trim()
      .slice(0, 500);
  const [r] = await db().execute(
    "UPDATE members SET status='suspended',suspension_until=?,suspension_reason=?,suspended_at=NOW(),suspension_notice_seen_at=NULL WHERE id=? AND deleted_at IS NULL AND status='active'",
    [until, reason || null, req.params.id]
  );
  if (!r.affectedRows) {
    const [rows] = await db().execute(`SELECT ${fields} FROM members WHERE id=?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Member not found' });
    return res
      .status(400)
      .json({ message: `Only active members can be suspended. This member is ${rows[0].status}.` });
  }
  const [rows] = await db().execute(`SELECT ${fields} FROM members WHERE id=?`, [req.params.id]);
  res.json(revealContact(record(rows[0])));
});
router.delete('/:id/suspension', authorize('admin'), async (req, res) => {
  await db().execute(
    "UPDATE members SET status='active',suspension_until=NULL,suspension_reason=NULL,suspended_at=NULL,suspension_notice_seen_at=NULL WHERE id=? AND deleted_at IS NULL AND status='suspended'",
    [req.params.id]
  );
  const [rows] = await db().execute(`SELECT ${fields} FROM members WHERE id=?`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Member not found' });
  res.json(revealContact(record(rows[0])));
});
router.delete('/:id', authorize('admin'), async (req, res) => {
  if (!hasId(req.params.id)) return res.status(400).json({ message: 'Invalid member id' });
  try {
    await transaction(async (connection) => {
      await connection.execute("SELECT setting_key FROM gym_settings WHERE setting_key='main' FOR UPDATE");
      const [open] = await connection.execute('SELECT id FROM attendance WHERE member_id=? AND check_out IS NULL LIMIT 1', [req.params.id]);
      if (open.length) {
        const error = new Error('Check out this member before removing them.');
        error.status = 409;
        throw error;
      }
      const [r] = await connection.execute(
        "UPDATE members SET status='inactive',deleted_at=NOW(),portal_invite_hash=NULL,portal_invite_expires_at=NULL,suspension_until=NULL,suspension_reason=NULL,suspended_at=NULL,suspension_notice_seen_at=NULL WHERE id=? AND deleted_at IS NULL",
        [req.params.id]
      );
      if (!r.affectedRows) {
        const error = new Error('Member not found');
        error.status = 404;
        throw error;
      }
    });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
  const [rows] = await db().execute(`SELECT ${fields} FROM members WHERE id=?`, [req.params.id]);
  res.json({ message: 'Member removed from the directory. Their login is revoked and history is kept.', member: revealContact(record(rows[0])) });
});
export default router;

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { db, record, hasId } from '../database/connection.js';
import { authenticate } from '../middleware/auth.js';
import { expireSuspensions } from '../services/attendance.js';

const router = express.Router();
router.post('/login', async (req, res) => {
  try {
    const identity = String(req.body?.username || '')
      .trim()
      .toLowerCase();
    const [rows] = await db().execute(
      'SELECT id,username,email,password,role FROM users WHERE username=? OR email=? LIMIT 1',
      [identity, identity]
    );
    const user = rows[0];
    // Check the entered password against its saved hash; passwords are not decrypted.
    if (!user || !(await bcrypt.compare(String(req.body?.password || ''), user.password)))
      return res.status(401).json({ message: 'Invalid credentials' });
    if (user.role === 'member') {
      const [members] = await db().execute(
        'SELECT id FROM members WHERE user_id=? AND deleted_at IS NULL LIMIT 1', [user.id]
      );
      if (!members.length) return res.status(401).json({ message: 'Member account is no longer available' });
    }
    const token = jwt.sign(
      { id: String(user.id), role: user.role, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    res.json({
      token,
      user: { id: String(user.id), username: user.username, role: user.role, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not sign in' });
  }
});
router.post('/register-member', async (req, res) => {
  const connection = await db().getConnection();
  try {
    await expireSuspensions();
    const email = String(req.body?.email || '')
        .trim()
        .toLowerCase(),
      code = String(req.body?.inviteCode || '').trim(),
      password = String(req.body?.password || '');
    if (!email || code.length < 20 || password.length < 8)
      return res.status(400).json({
        message: 'Enter your member email, invitation code and a password of at least 8 characters'
      });
    // Lock this member record so two requests cannot use the same invite at once.
    await connection.beginTransaction();
    const [members] = await connection.execute('SELECT * FROM members WHERE email=? FOR UPDATE', [
      email
    ]);
    const member = members[0];
    if (!member)
      return res.status(404).json({
        message:
          'No gym member record matches that email. Ask the front desk to register you first.'
      });
    if (member.deleted_at || member.status !== 'active')
      return res.status(403).json({ message: 'Only active members can create a portal account' });
    if (member.user_id)
      return res.status(409).json({ message: 'This member record already has a portal account' });
    const [paid] = await connection.execute(
      "SELECT id FROM memberships WHERE member_id=? AND status='active' AND start_date<=NOW() AND end_date>=NOW() LIMIT 1",
      [member.id]
    );
    if (!paid.length)
      return res.status(403).json({
        message:
          'An active account membership payment is required before account setup. Please contact the front desk.'
      });
    // Hash the entered invite code so it can be compared with the saved hash.
    const digest = createHash('sha256').update(code).digest('hex');
    if (
      member.portal_invite_hash !== digest ||
      !member.portal_invite_expires_at ||
      new Date(member.portal_invite_expires_at) < new Date()
    )
      return res.status(403).json({
        message: 'The invitation code is invalid or expired. Ask the front desk for a new one.'
      });
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email))
      return res.status(400).json({ message: 'Enter a valid email address' });
    // Hash the password before saving it; never save the original password.
    const hashed = await bcrypt.hash(password, 12);
    // Create the login and link it to the member in the same transaction.
    const [created] = await connection.execute(
      "INSERT INTO users(username,email,password,role) VALUES(?,?,?,'member')",
      [email, email, hashed]
    );
    await connection.execute(
      'UPDATE members SET user_id=?,portal_invite_hash=NULL,portal_invite_expires_at=NULL WHERE id=?',
      [created.insertId, member.id]
    );
    await connection.commit();
    const id = String(created.insertId),
      token = jwt.sign({ id, role: 'member', username: email }, process.env.JWT_SECRET, {
        expiresIn: '1d'
      });
    res.status(201).json({ token, user: { id, username: email, role: 'member', email } });
  } catch (error) {
    await connection.rollback().catch(() => {});
    res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 400).json({
      message: 'Unable to create member account',
      error:
        error.code === 'ER_DUP_ENTRY' ? 'An account already exists for this email' : error.message
    });
  } finally {
    // End any unfinished transaction, including when validation stopped early.
    await connection.rollback().catch(() => {});
    connection.release();
  }
});
router.get('/me', authenticate, async (req, res) => {
  const [rows] = await db().execute(
    'SELECT id AS _id,username,email,role,created_at AS createdAt FROM users WHERE id=?',
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'User not found' });
  res.json(record(rows[0]));
});
export default router;

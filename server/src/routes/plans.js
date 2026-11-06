import express from 'express';
import { db, records, record, hasId } from '../database/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { titleCaseWords } from '../services/titleCase.js';

const router = express.Router();
router.use(authenticate, authorize('admin', 'staff'));
const columns = 'id AS _id,name,duration,price,type,features,is_active AS isActive';
router.get('/', async (_req, res) => {
  const [rows] = await db().execute(
    `SELECT ${columns} FROM membership_plans WHERE is_active=1 ORDER BY price`
  );
  res.json(
    records(rows).map((x) => ({
      ...x,
      features: typeof x.features === 'string' ? JSON.parse(x.features || '[]') : x.features
    }))
  );
});
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const name = titleCaseWords(req.body?.name);
    if (
      !name ||
      !Number.isInteger(Number(req.body.duration)) ||
      Number(req.body.duration) < 1 ||
      Number(req.body.duration) > 120 ||
      Number(req.body.price) <= 0
    )
      return res.status(400).json({ message: 'Enter a plan name, duration and positive price' });
    const [result] = await db().execute(
      'INSERT INTO membership_plans(name,duration,price,type,features) VALUES(?,?,?,?,?)',
      [
        name,
        Number(req.body.duration),
        Number(req.body.price),
        'account_membership',
        JSON.stringify(req.body.features || [])
      ]
    );
    const [rows] = await db().execute(`SELECT ${columns} FROM membership_plans WHERE id=?`, [
      result.insertId
    ]);
    res.status(201).json(record(rows[0]));
  } catch (error) {
    res
      .status(error.code === 'ER_DUP_ENTRY' ? 409 : 400)
      .json({ message: 'Could not create plan', error: error.message });
  }
});
router.put('/:id', authorize('admin'), async (req, res) => {
  if (!hasId(req.params.id)) return res.status(400).json({ message: 'Invalid plan id' });
  try {
    const allowed = ['name', 'duration', 'price', 'features', 'isActive'],
      current = { ...req.body };
    if (current.name) current.name = titleCaseWords(current.name);
    const map = {
      name: 'name',
      duration: 'duration',
      price: 'price',
      features: 'features',
      isActive: 'is_active'
    };
    const keys = allowed.filter((k) => Object.hasOwn(current, k));
    if (!keys.length) return res.status(400).json({ message: 'No plan fields to update' });
    const vals = keys.map((k) => (k === 'features' ? JSON.stringify(current[k]) : current[k]));
    await db().execute(
      `UPDATE membership_plans SET ${keys.map((k) => `${map[k]}=?`).join(',')} WHERE id=?`,
      [...vals, req.params.id]
    );
    const [rows] = await db().execute(`SELECT ${columns} FROM membership_plans WHERE id=?`, [
      req.params.id
    ]);
    if (!rows.length) return res.status(404).json({ message: 'Plan not found' });
    const result = record(rows[0]);
    result.features =
      typeof result.features === 'string' ? JSON.parse(result.features || '[]') : result.features;
    res.json(result);
  } catch (error) {
    res
      .status(error.code === 'ER_DUP_ENTRY' ? 409 : 400)
      .json({ message: 'Could not update plan', error: error.message });
  }
});
router.delete('/:id', authorize('admin'), async (req, res) => {
  if (!hasId(req.params.id)) return res.status(400).json({ message: 'Invalid plan id' });
  const [result] = await db().execute('UPDATE membership_plans SET is_active=0 WHERE id=?', [
    req.params.id
  ]);
  if (!result.affectedRows) return res.status(404).json({ message: 'Plan not found' });
  res.json({ message: 'Account membership plan archived' });
});
export default router;

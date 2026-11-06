import express from 'express';
import { db, records, record, hasId } from '../database/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { titleCaseWords } from '../services/titleCase.js';
const router = express.Router();
router.use(authenticate, authorize('admin', 'staff'));
const cols = 'id AS _id,name,duration,duration_unit AS durationUnit,price,is_active AS isActive';
router.get('/', async (_q, res) => {
  const [r] = await db().execute(
    `SELECT ${cols} FROM equipment_plans WHERE is_active=1 ORDER BY price`
  );
  res.json(records(r));
});
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const name = titleCaseWords(req.body.name),
      d = Number(req.body.duration),
      price = Number(req.body.price);
    if (
      !name ||
      !Number.isInteger(d) ||
      d < 1 ||
      price <= 0 ||
      !['day', 'month', 'year'].includes(req.body.durationUnit)
    )
      return res
        .status(400)
        .json({ message: 'Enter a valid plan name, duration, price and duration unit' });
    const [r] = await db().execute(
      'INSERT INTO equipment_plans(name,duration,duration_unit,price) VALUES(?,?,?,?)',
      [name, d, req.body.durationUnit, price]
    );
    const [rows] = await db().execute(`SELECT ${cols} FROM equipment_plans WHERE id=?`, [
      r.insertId
    ]);
    res.status(201).json(record(rows[0]));
  } catch (error) {
    res
      .status(error.code === 'ER_DUP_ENTRY' ? 409 : 400)
      .json({ message: 'Could not create gym plan', error: error.message });
  }
});
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    if (!hasId(req.params.id)) return res.status(400).json({ message: 'Invalid plan id' });
    const b = req.body,
      map = {
        name: 'name',
        duration: 'duration',
        durationUnit: 'duration_unit',
        price: 'price',
        isActive: 'is_active'
      },
      keys = Object.keys(map).filter((k) => Object.hasOwn(b, k));
    const vals = keys.map((k) => (k === 'name' ? titleCaseWords(b[k]) : b[k]));
    const [r] = await db().execute(
      `UPDATE equipment_plans SET ${keys.map((k) => `${map[k]}=?`).join(',')} WHERE id=?`,
      [...vals, req.params.id]
    );
    if (!r.affectedRows) return res.status(404).json({ message: 'Equipment plan not found' });
    const [rows] = await db().execute(`SELECT ${cols} FROM equipment_plans WHERE id=?`, [
      req.params.id
    ]);
    res.json(record(rows[0]));
  } catch (error) {
    res
      .status(error.code === 'ER_DUP_ENTRY' ? 409 : 400)
      .json({ message: 'Could not update gym plan', error: error.message });
  }
});
router.delete('/:id', authorize('admin'), async (req, res) => {
  const [r] = await db().execute('UPDATE equipment_plans SET is_active=0 WHERE id=?', [
    req.params.id
  ]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Gym plan not found' });
  res.json({ message: 'Gym plan archived' });
});
export default router;

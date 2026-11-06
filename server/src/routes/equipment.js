import express from 'express';
import { db, records, record, hasId, transaction } from '../database/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = express.Router();
router.use(authenticate, authorize('admin', 'staff'));
const cols =
  'id AS _id,name,category,brand,purchase_date AS purchaseDate,condition_status AS `condition`,is_archived AS isArchived,archived_at AS archivedAt,location';
const getEquipment = async (id) => {
  const [rows] = await db().execute(`SELECT ${cols} FROM equipment WHERE id=?`, [id]);
  if (!rows.length) return null;
  const [logs] = await db().execute(
    'SELECT id AS _id,id AS id,date,type,description,priority,resolved_date AS resolvedDate,performed_by AS performedBy,status FROM maintenance_logs WHERE equipment_id=? ORDER BY date DESC',
    [id]
  );
  return { ...record(rows[0]), maintenanceLogs: records(logs) };
};
router.get('/', async (req, res) => {
  let sql = `SELECT ${cols} FROM equipment WHERE is_archived=0`,
    params = [];
  if (req.query.condition) {
    sql += ' AND condition_status=?';
    params.push(req.query.condition);
  }
  sql += ' ORDER BY name';
  const [rows] = await db().execute(sql, params);
  const all = records(rows);
  const [logs] = all.length
    ? await db().execute(
        `SELECT id AS _id,id AS id,equipment_id AS equipmentId,date,type,description,priority,resolved_date AS resolvedDate,performed_by AS performedBy,status FROM maintenance_logs WHERE equipment_id IN (${all.map(() => '?').join(',')}) ORDER BY date DESC`,
        all.map((x) => x.id)
      )
    : [[]];
  const grouped = new Map();
  for (const l of logs) {
    const list = grouped.get(String(l.equipmentId)) || [];
    list.push(record(l));
    grouped.set(String(l.equipmentId), list);
  }
  res.json(all.map((x) => ({ ...x, maintenanceLogs: grouped.get(x.id) || [] })));
});
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const b = req.body;
    if (!b.name) return res.status(400).json({ message: 'Equipment name is required' });
    const [r] = await db().execute(
      'INSERT INTO equipment(name,category,brand,location,purchase_date,condition_status) VALUES(?,?,?,?,?,?)',
      [
        b.name,
        b.category || null,
        b.brand || null,
        b.location || null,
        b.purchaseDate || null,
        b.condition || 'operational'
      ]
    );
    res.status(201).json(await getEquipment(r.insertId));
  } catch (error) {
    res.status(400).json({ message: 'Error creating equipment', error: error.message });
  }
});
router.put('/:id', authorize('admin'), async (req, res) => {
  if (!hasId(req.params.id)) return res.status(400).json({ message: 'Invalid equipment id' });
  try {
    const b = req.body,
      map = {
        name: 'name',
        category: 'category',
        brand: 'brand',
        location: 'location',
        purchaseDate: 'purchase_date',
        condition: 'condition_status'
      },
      keys = Object.keys(map).filter((k) => Object.hasOwn(b, k));
    if (!keys.length) return res.status(400).json({ message: 'No equipment fields to update' });
    const [r] = await db().execute(
      `UPDATE equipment SET ${keys.map((k) => `${map[k]}=?`).join(',')} WHERE id=? AND is_archived=0`,
      [...keys.map((k) => b[k] || null), req.params.id]
    );
    if (!r.affectedRows) return res.status(404).json({ message: 'Equipment not found' });
    res.json(await getEquipment(req.params.id));
  } catch (error) {
    res.status(400).json({ message: 'Error updating equipment', error: error.message });
  }
});
router.delete('/:id', authorize('admin'), async (req, res) => {
  const [open] = await db().execute(
    "SELECT id FROM maintenance_logs WHERE equipment_id=? AND status<>'resolved' LIMIT 1",
    [req.params.id]
  );
  if (open.length)
    return res
      .status(409)
      .json({ message: 'Resolve all open maintenance tickets before removing this equipment.' });
  const [r] = await db().execute(
    'UPDATE equipment SET is_archived=1,archived_at=NOW() WHERE id=? AND is_archived=0',
    [req.params.id]
  );
  if (!r.affectedRows) return res.status(404).json({ message: 'Equipment not found' });
  res.json({
    message: 'Equipment removed from the active register. Maintenance history has been preserved.'
  });
});
router.post('/:id/maintenance', async (req, res) => {
  try {
    const equipment = await getEquipment(req.params.id);
    if (!equipment || equipment.isArchived)
      return res.status(404).json({ message: 'Equipment not found' });
    const b = req.body;
    const [r] = await db().execute(
      'INSERT INTO maintenance_logs(equipment_id,type,description,priority,performed_by) VALUES(?,?,?,?,?)',
      [
        req.params.id,
        b.type || 'inspection',
        String(b.description || '').trim(),
        b.priority || 'low',
        req.user.username
      ]
    );
    if (req.user.role === 'admin' && b.condition)
      await db().execute('UPDATE equipment SET condition_status=? WHERE id=?', [
        b.condition,
        req.params.id
      ]);
    res.status(201).json(await getEquipment(req.params.id));
  } catch (error) {
    res.status(400).json({ message: 'Error adding maintenance log', error: error.message });
  }
});
router.put('/:id/maintenance/:logId', async (req, res) => {
  if (!hasId(req.params.id) || !hasId(req.params.logId))
    return res.status(400).json({ message: 'Invalid maintenance id' });
  const { status, condition } = req.body;
  if (status && !['open', 'in_progress', 'resolved'].includes(status))
    return res.status(400).json({ message: 'Invalid maintenance status' });
  if (condition && !['operational', 'needs_inspection', 'under_maintenance', 'out_of_order'].includes(condition))
    return res.status(400).json({ message: 'Invalid equipment condition' });
  if (condition && req.user.role !== 'admin')
    return res.status(403).json({ message: 'Only admins can change equipment condition.' });
  if (!status && !condition)
    return res.status(400).json({ message: 'Choose a status or condition to update.' });
  try {
    await transaction(async (connection) => {
      const [[equipment]] = await connection.execute(
        'SELECT id FROM equipment WHERE id=? AND is_archived=0 FOR UPDATE', [req.params.id]
      );
      if (!equipment) throw Object.assign(new Error('Equipment not found'), { status: 404 });
      const [[log]] = await connection.execute(
        'SELECT id FROM maintenance_logs WHERE id=? AND equipment_id=? FOR UPDATE',
        [req.params.logId, req.params.id]
      );
      if (!log) throw Object.assign(new Error('Maintenance ticket not found'), { status: 404 });
      if (status) {
        // Let MySQL set the completion time so staff do not have to enter one.
        await connection.execute(
          'UPDATE maintenance_logs SET status=?,resolved_date=IF(?=\'resolved\',NOW(),NULL) WHERE id=?',
          [status, status, req.params.logId]
        );
      }
      if (condition) {
        await connection.execute('UPDATE equipment SET condition_status=? WHERE id=?', [condition, req.params.id]);
      } else if (status === 'resolved') {
        const [[remaining]] = await connection.execute(
          "SELECT COUNT(*) AS total FROM maintenance_logs WHERE equipment_id=? AND status<>'resolved'",
          [req.params.id]
        );
        if (remaining.total === 0)
          await connection.execute("UPDATE equipment SET condition_status='operational' WHERE id=?", [req.params.id]);
      }
    });
    res.json(await getEquipment(req.params.id));
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
});
export default router;

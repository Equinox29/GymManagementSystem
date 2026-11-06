import express from 'express';
import { db, records, record, hasId, transaction } from '../database/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = express.Router();
router.use(authenticate, authorize('admin', 'staff'));
const cols =
  'id AS _id,name,category,quantity,unit_price AS unitPrice,is_sellable AS isSellable,reorder_level AS reorderLevel,supplier,image_url AS imageUrl,is_archived AS isArchived,archived_at AS archivedAt,created_at AS createdAt';
router.get('/', async (req, res) => {
  let sql = `SELECT ${cols} FROM inventory_items WHERE is_archived=0`,
    params = [];
  if (req.query.category) {
    sql += ' AND category=?';
    params.push(req.query.category);
  }
  if (req.query.lowStock === 'true') sql += ' AND quantity<=reorder_level';
  sql += ' ORDER BY name';
  const [r] = await db().execute(sql, params);
  res.json(records(r));
});
router.get('/transactions', async (req, res) => {
  if (req.query.itemId && !hasId(req.query.itemId))
    return res.status(400).json({ message: 'Invalid item id' });
  if (req.query.type && !['restock', 'sale', 'adjustment', 'damaged', 'archive'].includes(req.query.type))
    return res.status(400).json({ message: 'Invalid transaction type' });
  const limit = Math.min(200, Math.max(1, Math.floor(Number(req.query.limit) || 100)));
  const requestedOffset = Number(req.query.offset || 0);
  const offset = Number.isSafeInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0;
  const filters = [];
  const params = [];
  if (req.query.itemId) { filters.push('t.item_id=?'); params.push(req.query.itemId); }
  if (req.query.type) { filters.push('t.type=?'); params.push(req.query.type); }
  const filter = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  params.push(limit, offset);
  const [rows] = await db().execute(
    `SELECT t.id AS _id,t.item_id AS itemId,i.name AS itemName,i.is_archived AS isArchived,
      t.type,t.quantity,t.unit_price AS unitPrice,t.total_amount AS totalAmount,
      t.notes,t.performed_by AS performedBy,t.date
     FROM inventory_transactions t JOIN inventory_items i ON i.id=t.item_id
     ${filter} ORDER BY t.date DESC,t.id DESC LIMIT ? OFFSET ?`, params
  );
  res.json(records(rows));
});
router.get('/sales', async (req, res) => {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const validDate = value => {
    if (!datePattern.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if ((req.query.from && !validDate(req.query.from)) || (req.query.to && !validDate(req.query.to)))
    return res.status(400).json({ message: 'Use YYYY-MM-DD for sale dates.' });
  if (req.query.itemId && !hasId(req.query.itemId))
    return res.status(400).json({ message: 'Invalid item id' });
  const search = String(req.query.search || '').trim();
  if (search.length > 100)
    return res.status(400).json({ message: 'Search text is too long.' });
  if (req.query.from && req.query.to && req.query.from > req.query.to)
    return res.status(400).json({ message: 'Start date must be before end date.' });
  const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 25)));
  const requestedOffset = Number(req.query.offset || 0);
  const offset = Number.isSafeInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0;
  const where = ["t.type='sale'"];
  const params = [];
  if (req.query.from) { where.push('t.date>=?'); params.push(req.query.from); }
  if (req.query.to) { where.push('t.date<DATE_ADD(?,INTERVAL 1 DAY)'); params.push(req.query.to); }
  if (req.query.itemId) { where.push('t.item_id=?'); params.push(req.query.itemId); }
  if (search) { where.push('LOCATE(?,i.name)>0'); params.push(search); }
  const filter = where.join(' AND ');
  const [[summary]] = await db().execute(
    `SELECT COUNT(*) AS saleCount,COALESCE(SUM(t.quantity),0) AS unitsSold,
      COALESCE(SUM(t.total_amount),0) AS revenue,COUNT(DISTINCT t.item_id) AS productsSold
     FROM inventory_transactions t JOIN inventory_items i ON i.id=t.item_id WHERE ${filter}`, params
  );
  const [rows] = await db().execute(
    `SELECT t.id AS _id,t.item_id AS itemId,i.name AS itemName,i.category,
      t.quantity,t.unit_price AS unitPrice,t.total_amount AS totalAmount,
      t.notes,t.performed_by AS performedBy,t.date
     FROM inventory_transactions t JOIN inventory_items i ON i.id=t.item_id
     WHERE ${filter} ORDER BY t.date DESC,t.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  res.json({ summary, sales: records(rows), hasMore: offset + rows.length < summary.saleCount });
});
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const b = req.body;
    if (
      !b.name ||
      !['supplement', 'drink', 'other'].includes(b.category) ||
      Number(b.unitPrice) < 0
    )
      return res
        .status(400)
        .json({ message: 'Enter a name, valid category and non-negative price' });
    const initialQuantity = Number(b.quantity ?? 0);
    if (!Number.isInteger(initialQuantity) || initialQuantity < 0)
      return res.status(400).json({ message: 'Initial quantity must be a non-negative whole number' });
    const r = await transaction(async (c) => {
      const [created] = await c.execute(
        'INSERT INTO inventory_items(name,category,quantity,unit_price,is_sellable,reorder_level,supplier,image_url) VALUES(?,?,?,?,?,?,?,?)',
        [b.name, b.category, initialQuantity, Number(b.unitPrice), b.isSellable === false ? 0 : 1,
          Number(b.reorderLevel ?? 5), b.supplier || null, b.imageUrl || null]
      );
      if (initialQuantity > 0)
        await c.execute(
          "INSERT INTO inventory_transactions(item_id,type,quantity,unit_price,total_amount,notes,performed_by) VALUES(?,'restock',?,?,?,'Opening stock',?)",
          [created.insertId, initialQuantity, Number(b.unitPrice), initialQuantity * Number(b.unitPrice), req.user.username]
        );
      return created;
    });
    const [rows] = await db().execute(`SELECT ${cols} FROM inventory_items WHERE id=?`, [
      r.insertId
    ]);
    res.status(201).json(record(rows[0]));
  } catch (error) {
    res.status(400).json({ message: 'Error creating item', error: error.message });
  }
});
router.put('/:id', authorize('admin'), async (req, res) => {
  if (!hasId(req.params.id)) return res.status(400).json({ message: 'Invalid item id' });
  try {
    const b = req.body,
      map = {
        name: 'name',
        category: 'category',
        unitPrice: 'unit_price',
        reorderLevel: 'reorder_level',
        supplier: 'supplier',
        imageUrl: 'image_url',
        isSellable: 'is_sellable'
      },
      keys = Object.keys(map).filter((k) => Object.hasOwn(b, k));
    const vals = keys.map((k) => (k === 'isSellable' ? Boolean(b[k]) : b[k]));
    const [r] = await db().execute(
      `UPDATE inventory_items SET ${keys.map((k) => `${map[k]}=?`).join(',')} WHERE id=? AND is_archived=0`,
      [...vals, req.params.id]
    );
    if (!r.affectedRows) return res.status(404).json({ message: 'Item not found' });
    const [rows] = await db().execute(`SELECT ${cols} FROM inventory_items WHERE id=?`, [
      req.params.id
    ]);
    res.json(record(rows[0]));
  } catch (error) {
    res.status(400).json({ message: 'Error updating item', error: error.message });
  }
});
router.delete('/:id', authorize('admin'), async (req, res) => {
  if (!hasId(req.params.id)) return res.status(400).json({ message: 'Invalid item id' });
  try {
    await transaction(async (c) => {
      const [rows] = await c.execute(
        'SELECT id,quantity,unit_price FROM inventory_items WHERE id=? AND is_archived=0 FOR UPDATE',
        [req.params.id]
      );
      if (!rows.length) throw Object.assign(new Error('Inventory item not found'), { status: 404 });
      await c.execute('UPDATE inventory_items SET is_archived=1,archived_at=NOW() WHERE id=?', [req.params.id]);
      await c.execute(
        "INSERT INTO inventory_transactions(item_id,type,quantity,unit_price,total_amount,notes,performed_by) VALUES(?,'archive',?,?,NULL,'Item removed from active inventory',?)",
        [req.params.id, rows[0].quantity, rows[0].unit_price, req.user.username]
      );
    });
    res.json({ message: 'Inventory item removed and recorded in the transaction log.' });
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
});
router.post('/:id/restock', authorize('admin'), async (req, res) => {
  // Only admins can add stock.
  const quantity = Number(req.body.quantity),
    price = req.body.unitPrice == null ? null : Number(req.body.unitPrice);
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    (price !== null && (!Number.isFinite(price) || price < 0))
  )
    return res
      .status(400)
      .json({
        message: 'Quantity must be a positive whole number and unit price must be non-negative'
      });
  try {
    const result = await transaction(async (c) => {
      // Lock this item while adding stock and recording the restock.
      const [rows] = await c.execute(
        `SELECT ${cols} FROM inventory_items WHERE id=? AND is_archived=0 FOR UPDATE`,
        [req.params.id]
      );
      const item = rows[0];
      if (!item) throw Object.assign(new Error('Item not found'), { status: 404 });
      await c.execute('UPDATE inventory_items SET quantity=quantity+? WHERE id=?', [
        quantity,
        req.params.id
      ]);
      const unit = price ?? Number(item.unitPrice);
      const [r] = await c.execute(
        "INSERT INTO inventory_transactions(item_id,type,quantity,unit_price,total_amount,notes,performed_by) VALUES(?,'restock',?,?,?,?,?)",
        [req.params.id, quantity, unit, unit * quantity, req.body.notes || null, req.user.username]
      );
      const [updated] = await c.execute(`SELECT ${cols} FROM inventory_items WHERE id=?`, [
        req.params.id
      ]);
      return {
        item: record(updated[0]),
        transaction: {
          _id: String(r.insertId),
          itemId: req.params.id,
          type: 'restock',
          quantity,
          unitPrice: unit,
          totalAmount: unit * quantity
        }
      };
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 400).json({ message: 'Error restocking', error: error.message });
  }
});
router.post('/:id/sell', async (req, res) => {
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1)
    return res.status(400).json({ message: 'Quantity must be a positive whole number' });
  try {
    const result = await transaction(async (c) => {
      // Lock this item so another sale waits until this stock update finishes.
      const [rows] = await c.execute(
        `SELECT ${cols} FROM inventory_items WHERE id=? AND is_archived=0 FOR UPDATE`,
        [req.params.id]
      );
      const item = rows[0];
      if (!item) throw Object.assign(new Error('Item not found'), { status: 404 });
      if (!item.isSellable)
        throw Object.assign(new Error('This item is not for sale'), { status: 409 });
      if (item.quantity < quantity)
        throw Object.assign(new Error('Insufficient stock'), { status: 409 });
      await c.execute('UPDATE inventory_items SET quantity=quantity-? WHERE id=?', [
        quantity,
        req.params.id
      ]);
      const unit = Number(item.unitPrice);
      // Record the sale. If this fails, undo the stock decrease too.
      const [r] = await c.execute(
        "INSERT INTO inventory_transactions(item_id,type,quantity,unit_price,total_amount,notes,performed_by) VALUES(?,'sale',?,?,?,?,?)",
        [req.params.id, quantity, unit, unit * quantity, req.body.notes || null, req.user.username]
      );
      const [updated] = await c.execute(`SELECT ${cols} FROM inventory_items WHERE id=?`, [
        req.params.id
      ]);
      return {
        item: record(updated[0]),
        transaction: {
          _id: String(r.insertId),
          itemId: req.params.id,
          type: 'sale',
          quantity,
          unitPrice: unit,
          totalAmount: unit * quantity
        }
      };
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
});
export default router;

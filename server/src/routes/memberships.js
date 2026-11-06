import express from 'express';
import { db, records, record, hasId, parseJson } from '../database/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { createPlanCheckout } from '../services/billing.js';

const router = express.Router();
router.use(authenticate, authorize('admin', 'staff'));
router.get('/', async (_req, res) => {
  // Get memberships, member names and plan details in one query.
  const [rows] = await db()
    .execute(`SELECT m.id AS _id,m.id AS id,m.member_id AS memberId,m.plan_id AS planId,m.start_date AS startDate,m.end_date AS endDate,m.status,m.created_at AS createdAt,
JSON_OBJECT('_id',mb.id,'firstName',mb.first_name,'lastName',mb.last_name,'email',mb.email,'status',mb.status) AS memberIdObj,
JSON_OBJECT('_id',p.id,'name',p.name,'duration',p.duration,'price',p.price) AS planIdObj
FROM memberships m JOIN members mb ON mb.id=m.member_id JOIN membership_plans p ON p.id=m.plan_id ORDER BY m.created_at DESC`);
  res.json(
    records(rows).map((x) => ({
      ...x,
      memberId: parseJson(x.memberIdObj),
      planId: parseJson(x.planIdObj)
    }))
  );
});
router.post('/', async (req, res) => {
  try {
    const sale = await createPlanCheckout({
      memberId: req.body.memberId, membershipPlanId: req.body.planId,
      amount: req.body.amount, paymentMethod: req.body.paymentMethod,
      requestedStartDate: req.body.startDate, role: req.user.role
    });
    res.status(201).json({
      _id: sale.membership.id, id: sale.membership.id, memberId: sale.memberId,
      planId: sale.membership.planId, startDate: sale.membership.startDate,
      endDate: sale.membership.endDate, status: 'active', receiptNumber: sale.receiptNumber
    });
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
});
router.put('/:id', authorize('admin'), async (req, res) => {
  if (!hasId(req.params.id)) return res.status(400).json({ message: 'Invalid membership id' });
  const status = ['active', 'expired', 'cancelled', 'expiring_soon'].includes(req.body.status)
    ? req.body.status
    : null;
  if (!status) return res.status(400).json({ message: 'Invalid membership status' });
  const [r] = await db().execute('UPDATE memberships SET status=? WHERE id=?', [
    status,
    req.params.id
  ]);
  if (!r.affectedRows) return res.status(404).json({ message: 'Membership not found' });
  const [rows] = await db().execute(
    'SELECT id AS _id,member_id AS memberId,plan_id AS planId,start_date AS startDate,end_date AS endDate,status FROM memberships WHERE id=?',
    [req.params.id]
  );
  res.json(record(rows[0]));
});
router.delete('/:id', authorize('admin'), async (req, res) => {
  if (!hasId(req.params.id)) return res.status(400).json({ message: 'Invalid membership id' });
  const [r] = await db().execute(
    "UPDATE memberships SET status='cancelled' WHERE id=? AND status<>'cancelled'",
    [req.params.id]
  );
  if (!r.affectedRows) return res.status(404).json({ message: 'Membership not found' });
  res.json({ message: 'Membership cancelled' });
});
export default router;

import express from 'express';
import { db, records, record, hasId, transaction, parseJson } from '../database/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { createPlanCheckout } from '../services/billing.js';
const router = express.Router();
// Admins and staff can collect payments. Only admins can refund them.
router.use(authenticate, authorize('admin', 'staff'));
router.get('/', async (req, res) => {
  let sql = `SELECT p.id AS _id,p.id AS id,p.member_id AS memberId,p.membership_id AS membershipId,p.plan_id AS planId,p.equipment_subscription_id AS equipmentSubscriptionId,p.equipment_plan_id AS equipmentPlanId,p.purchase_type AS purchaseType,p.amount,p.payment_date AS paymentDate,p.payment_method AS paymentMethod,p.status,p.receipt_number AS receiptNumber,p.notes,
JSON_OBJECT('_id',m.id,'firstName',m.first_name,'lastName',m.last_name) member_json,
mp.name AS membershipPlanName,ep.name AS gymPlanName,ep.duration AS equipmentDuration,ep.duration_unit AS equipmentDurationUnit FROM payments p JOIN members m ON m.id=p.member_id LEFT JOIN membership_plans mp ON mp.id=p.plan_id LEFT JOIN equipment_plans ep ON ep.id=p.equipment_plan_id`;
  let params = [];
  if (req.query.memberId) {
    // Filter by member; the member/date index helps find their payment history.
    sql += ' WHERE p.member_id=?';
    params.push(req.query.memberId);
  }
  sql += ' ORDER BY p.payment_date DESC';
  const [rows] = await db().execute(sql, params);
  res.json(
    records(rows).map((p) => ({
      ...p,
      memberId: parseJson(p.member_json),
      planId: p.membershipPlanName ? { name: p.membershipPlanName } : null,
      equipmentPlanId:
        p.equipmentPlanId && p.gymPlanName
          ? {
              name: p.gymPlanName,
              duration: p.equipmentDuration,
              durationUnit: p.equipmentDurationUnit
            }
          : null
    }))
  );
});
router.get('/member/:id/plan-status', async (req, res) => {
  if (!hasId(req.params.id)) return res.status(400).json({ message: 'Invalid member id' });
  const [members] = await db().execute('SELECT id FROM members WHERE id=? AND deleted_at IS NULL', [req.params.id]);
  if (!members.length) return res.status(404).json({ message: 'Member not found' });
  const [[accountPlans], [gymPlans]] = await Promise.all([
    db().execute(
      "SELECT m.id AS _id,p.name AS planName,m.start_date AS startDate,m.end_date AS endDate FROM memberships m JOIN membership_plans p ON p.id=m.plan_id WHERE m.member_id=? AND m.status IN ('active','expiring_soon') AND m.end_date>NOW() ORDER BY m.start_date,m.id",
      [req.params.id]
    ),
    db().execute(
      "SELECT s.id AS _id,p.name AS planName,s.start_date AS startDate,s.end_date AS endDate FROM equipment_subscriptions s JOIN equipment_plans p ON p.id=s.plan_id WHERE s.member_id=? AND s.status='active' AND s.end_date>NOW() ORDER BY s.start_date,s.id",
      [req.params.id]
    )
  ]);
  const shape = (rows) => rows.map((row) => ({ ...record(row), state: new Date(row.startDate) <= new Date() ? 'current' : 'scheduled' }));
  res.json({ accountPlans: shape(accountPlans), gymPlans: shape(gymPlans) });
});
const checkout = async (req, res) => {
  try {
    const sale = await createPlanCheckout({
      memberId: req.body.memberId,
      membershipPlanId: req.body.membershipPlanId || req.body.planId,
      gymPlanId: req.body.gymPlanId || req.body.equipmentPlanId,
      amount: req.body.amount, paymentMethod: req.body.paymentMethod,
      notes: req.body.notes, role: req.user.role
    });
    res.status(201).json(sale);
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
};
router.post('/checkout', checkout);
router.post('/', checkout);
router.post('/:id/refund', authorize('admin'), async (req, res) => {
  if (!hasId(req.params.id)) return res.status(400).json({ message: 'Invalid payment id' });
  try {
    const row = await transaction(async (c) => {
      // Lock this payment so two requests cannot refund it at the same time.
      const [rows] = await c.execute('SELECT * FROM payments WHERE id=? FOR UPDATE', [
        req.params.id
      ]);
      const p = rows[0];
      if (!p) throw Object.assign(new Error('Payment not found'), { status: 404 });
      if (p.status === 'refunded')
        throw Object.assign(new Error('Payment has already been refunded'), { status: 409 });
      // Mark the refund and cancel its linked access together, or undo both.
      await c.execute("UPDATE payments SET status='refunded' WHERE id=?", [p.id]);
      if (p.membership_id)
        await c.execute("UPDATE memberships SET status='cancelled' WHERE id=?", [p.membership_id]);
      if (p.equipment_subscription_id)
        await c.execute("UPDATE equipment_subscriptions SET status='cancelled' WHERE id=?", [
          p.equipment_subscription_id
        ]);
      return p;
    });
    res.json(
      record({
        ...row,
        _id: row.id,
        memberId: row.member_id,
        membershipId: row.membership_id,
        planId: row.plan_id,
        amount: Number(row.amount),
        status: 'refunded'
      })
    );
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
});
export default router;

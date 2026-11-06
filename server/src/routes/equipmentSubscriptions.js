import express from 'express';
import { db, records, parseJson } from '../database/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { createPlanCheckout } from '../services/billing.js';
const router = express.Router();
router.use(authenticate, authorize('admin', 'staff'));
router.get('/', async (_req, res) => {
  const [r] = await db().execute(
    `SELECT s.id AS _id,s.member_id AS memberId,s.plan_id AS planId,s.start_date AS startDate,s.end_date AS endDate,s.status,s.created_at AS createdAt,JSON_OBJECT('_id',m.id,'firstName',m.first_name,'lastName',m.last_name,'status',m.status) member_json,JSON_OBJECT('_id',p.id,'name',p.name,'duration',p.duration,'durationUnit',p.duration_unit,'price',p.price) plan_json FROM equipment_subscriptions s JOIN members m ON m.id=s.member_id JOIN equipment_plans p ON p.id=s.plan_id ORDER BY s.created_at DESC`
  );
  res.json(
    records(r).map((x) => ({
      ...x,
      memberId: parseJson(x.member_json),
      planId: parseJson(x.plan_json)
    }))
  );
});
router.post('/', async (req, res) => {
  try {
    const sale = await createPlanCheckout({
      memberId: req.body.memberId, gymPlanId: req.body.planId,
      amount: req.body.amount, paymentMethod: req.body.paymentMethod,
      requestedStartDate: req.body.startDate, role: req.user.role
    });
    res.status(201).json({
      _id: sale.gymPlan.id, id: sale.gymPlan.id, memberId: sale.memberId,
      planId: sale.gymPlan.planId, startDate: sale.gymPlan.startDate,
      endDate: sale.gymPlan.endDate, status: 'active', receiptNumber: sale.receiptNumber
    });
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
});
export default router;

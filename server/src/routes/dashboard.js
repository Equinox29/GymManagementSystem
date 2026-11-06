import express from 'express';
import { db, records, parseJson } from '../database/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = express.Router();
router.get('/', authenticate, authorize('admin', 'staff'), async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin',
      now = new Date(),
      month = new Date(now.getFullYear(), now.getMonth(), 1),
      day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [
      [total],
      [active],
      [memberships],
      [checkins],
      [revenue],
      [inventorySales],
      [stock],
      [payments],
      [status],
      [expiring]
    ] = await Promise.all([
      db().execute('SELECT COUNT(*) n FROM members WHERE deleted_at IS NULL'),
      db().execute("SELECT COUNT(*) n FROM members WHERE status='active' AND deleted_at IS NULL"),
      db().execute("SELECT COUNT(*) n FROM memberships ms JOIN members m ON m.id=ms.member_id WHERE ms.status='active' AND m.deleted_at IS NULL"),
      db().execute('SELECT COUNT(*) n FROM attendance WHERE check_in>=?', [day]),
      isAdmin
        ? db().execute(
            "SELECT COALESCE(SUM(amount),0) n FROM payments WHERE payment_date>=? AND status='completed'",
            [month]
          )
        : Promise.resolve([[{ n: null }]]),
      isAdmin
        ? db().execute(
            "SELECT COALESCE(SUM(total_amount),0) n FROM inventory_transactions WHERE type='sale' AND date>=?",
            [month]
          )
        : Promise.resolve([[{ n: null }]]),
      db().execute(
        'SELECT id AS _id,name,category,quantity,unit_price AS unitPrice,reorder_level AS reorderLevel FROM inventory_items WHERE is_archived=0 AND quantity<=reorder_level ORDER BY quantity'
      ),
      isAdmin
        ? db().execute(
            `SELECT p.id AS _id,p.member_id AS memberId,p.amount,p.payment_date AS paymentDate,p.payment_method AS paymentMethod,p.status,JSON_OBJECT('_id',m.id,'firstName',m.first_name,'lastName',m.last_name) member_json,COALESCE(mp.name,ep.name) planName FROM payments p JOIN members m ON m.id=p.member_id LEFT JOIN membership_plans mp ON mp.id=p.plan_id LEFT JOIN equipment_plans ep ON ep.id=p.equipment_plan_id ORDER BY p.payment_date DESC LIMIT 5`
          )
        : Promise.resolve([[]]),
      db().execute('SELECT status,COUNT(*) count FROM members WHERE deleted_at IS NULL GROUP BY status'),
      db().execute(
        "SELECT ms.id AS _id,ms.end_date AS endDate,JSON_OBJECT('_id',m.id,'firstName',m.first_name,'lastName',m.last_name) member_json,JSON_OBJECT('_id',p.id,'name',p.name) plan_json FROM memberships ms JOIN members m ON m.id=ms.member_id JOIN membership_plans p ON p.id=ms.plan_id WHERE m.deleted_at IS NULL AND ms.status='active' AND ms.end_date BETWEEN NOW() AND DATE_ADD(NOW(),INTERVAL 7 DAY) ORDER BY ms.end_date"
      )
    ]);
    const membersByStatus = {};
    for (const s of status) membersByStatus[s.status] = s.count;
    res.json({
      totalMembers: total[0].n,
      activeMembers: active[0].n,
      activeMemberships: memberships[0].n,
      todayCheckIns: checkins[0].n,
      monthlyRevenue: isAdmin ? Number(revenue[0].n) + Number(inventorySales[0].n) : null,
      monthlyPlanRevenue: isAdmin ? revenue[0].n : null,
      monthlyInventoryRevenue: isAdmin ? inventorySales[0].n : null,
      lowStockItems: records(stock),
      recentPayments: records(payments).map((p) => ({
        ...p,
        memberId: parseJson(p.member_json),
        planId: p.planName ? { name: p.planName } : null
      })),
      membersByStatus,
      expiringMemberships: records(expiring).map((x) => ({
        ...x,
        memberId: parseJson(x.member_json),
        planId: parseJson(x.plan_json)
      }))
    });
  } catch (error) {
    console.error('Dashboard Error:', error);
    res.status(500).json({ message: 'Could not load dashboard' });
  }
});
export default router;

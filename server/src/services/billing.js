import { randomUUID } from 'node:crypto';
import { hasId, transaction } from '../database/connection.js';

const invalid = (message, status = 400) => Object.assign(new Error(message), { status });

function addTerm(start, duration, unit) {
  const end = new Date(start);
  if (unit === 'day') {
    end.setDate(end.getDate() + duration);
  } else {
    const day = end.getDate();
    end.setDate(1);
    if (unit === 'year') end.setFullYear(end.getFullYear() + duration);
    else end.setMonth(end.getMonth() + duration);
    end.setDate(Math.min(day, new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()));
  }
  return end;
}

// One checkout can buy either plan or both. Process one member's renewals in order.
export async function createPlanCheckout({
  memberId, membershipPlanId, gymPlanId, amount, paymentMethod = 'cash',
  notes = null, requestedStartDate, role
}) {
  if (!hasId(memberId) || (!membershipPlanId && !gymPlanId))
    throw invalid('Choose a member and at least one plan.');
  if (membershipPlanId && !hasId(membershipPlanId)) throw invalid('Invalid account plan.');
  if (gymPlanId && !hasId(gymPlanId)) throw invalid('Invalid gym plan.');
  if (!['cash', 'card', 'gcash', 'bank_transfer'].includes(paymentMethod))
    throw invalid('Choose a valid payment method.');
  if (requestedStartDate && Number.isNaN(new Date(requestedStartDate).getTime()))
    throw invalid('Start date is invalid.');
  return transaction(async (connection) => {
    const [[member]] = await connection.execute(
      'SELECT id,status FROM members WHERE id=? AND deleted_at IS NULL FOR UPDATE', [memberId]
    );
    if (!member) throw invalid('Member not found.', 404);
    if (member.status !== 'active') throw invalid('Only active members can buy a plan.', 403);
    const [[membershipPlan]] = membershipPlanId
      ? await connection.execute(
          'SELECT id,duration,price FROM membership_plans WHERE id=? AND is_active=1', [membershipPlanId]
        )
      : [[null]];
    const [[gymPlan]] = gymPlanId
      ? await connection.execute(
          'SELECT id,duration,duration_unit,price FROM equipment_plans WHERE id=? AND is_active=1', [gymPlanId]
        )
      : [[null]];
    if (membershipPlanId && !membershipPlan) throw invalid('Account plan not found.', 404);
    if (gymPlanId && !gymPlan) throw invalid('Gym plan not found.', 404);
    const listedTotal = Number(membershipPlan?.price || 0) + Number(gymPlan?.price || 0);
    const paid = amount == null ? listedTotal : Number(amount);
    if (!Number.isFinite(paid) || paid <= 0) throw invalid('Payment amount must be positive.');
    if (role !== 'admin' && Math.abs(paid - listedTotal) >= 0.005)
      throw invalid('Staff must use the listed total price.', 403);

    async function nextStart(table) {
      const [[row]] = await connection.execute(
        `SELECT MAX(end_date) AS latestEnd FROM ${table} WHERE member_id=? AND status IN ('active','expiring_soon') AND end_date>NOW()`,
        [memberId]
      );
      const start = new Date(Math.max(Date.now(), requestedStartDate ? new Date(requestedStartDate).getTime() : 0,
        row.latestEnd ? new Date(row.latestEnd).getTime() : 0));
      // MySQL DATETIME stores whole seconds, so return the same time that it saves.
      start.setMilliseconds(0);
      return start;
    }

    let membership = null;
    if (membershipPlan) {
      const start = await nextStart('memberships');
      const end = addTerm(start, membershipPlan.duration, 'month');
      const [result] = await connection.execute(
        "INSERT INTO memberships(member_id,plan_id,start_date,end_date,status) VALUES(?,?,?,?,'active')",
        [memberId, membershipPlanId, start, end]
      );
      membership = { id: String(result.insertId), planId: String(membershipPlanId), startDate: start, endDate: end };
    }
    let gymPlanSale = null;
    if (gymPlan) {
      const start = await nextStart('equipment_subscriptions');
      const end = addTerm(start, gymPlan.duration, gymPlan.duration_unit);
      const [result] = await connection.execute(
        "INSERT INTO equipment_subscriptions(member_id,plan_id,start_date,end_date,status) VALUES(?,?,?,?,'active')",
        [memberId, gymPlanId, start, end]
      );
      gymPlanSale = { id: String(result.insertId), planId: String(gymPlanId), startDate: start, endDate: end };
    }
    const purchaseType = membership && gymPlanSale ? 'bundle' : membership ? 'membership' : 'equipment';
    const receiptNumber = `RCP-${randomUUID()}`;
    const [payment] = await connection.execute(
      `INSERT INTO payments(member_id,membership_id,plan_id,equipment_subscription_id,equipment_plan_id,purchase_type,amount,payment_method,status,receipt_number,notes)
       VALUES(?,?,?,?,?,?,?,?,'completed',?,?)`,
      [memberId, membership?.id || null, membershipPlanId || null, gymPlanSale?.id || null,
        gymPlanId || null, purchaseType, paid, paymentMethod, receiptNumber, notes]
    );
    return {
      paymentId: String(payment.insertId), receiptNumber, purchaseType, amount: paid,
      memberId: String(memberId), membership, gymPlan: gymPlanSale
    };
  });
}

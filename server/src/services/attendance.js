import { db, transaction } from '../database/connection.js';
import { localDay } from './titleCase.js';

export const getVisitLimit = async () => {
  const [rows] = await db().execute(
    "SELECT member_visit_limit_minutes FROM gym_settings WHERE setting_key='main'"
  );
  return rows[0]?.member_visit_limit_minutes || 120;
};

export const expireSuspensions = async () => {
  const [result] = await db().execute(
    "UPDATE members SET status='active', suspension_until=NULL, suspension_reason=NULL, suspended_at=NULL, suspension_notice_seen_at=NULL WHERE status='suspended' AND suspension_until<=NOW()"
  );
  return result.affectedRows;
};

// Lock the settings row so simultaneous check-ins cannot both take the last place.
export const checkInWithCapacity = async ({ memberId, userId, visitLimitMinutes }) =>
  transaction(async (connection) => {
    const [[settings]] = await connection.execute(
      "SELECT max_capacity,member_visit_limit_minutes FROM gym_settings WHERE setting_key='main' FOR UPDATE"
    );
    const [[occupancy]] = await connection.execute(
      'SELECT COUNT(*) AS total FROM attendance WHERE check_out IS NULL'
    );
    if (occupancy.total >= settings.max_capacity) {
      const error = new Error(`Gym is full (${occupancy.total}/${settings.max_capacity}). Check out someone before admitting another person.`);
      error.status = 409;
      throw error;
    }
    if (memberId) {
      const [members] = await connection.execute(
        "SELECT id FROM members WHERE id=? AND status='active' AND deleted_at IS NULL FOR UPDATE", [memberId]
      );
      if (!members.length) {
        const error = new Error('Only active members can check in');
        error.status = 403;
        throw error;
      }
      const [gate] = await connection.execute(
        "SELECT id FROM equipment_subscriptions WHERE member_id=? AND status='active' AND start_date<=NOW() AND end_date>=NOW() LIMIT 1", [memberId]
      );
      if (!gate.length) {
        const error = new Error('An active Daily Plan, Monthly Plan, or Yearly Plan is required to check in.');
        error.status = 403;
        throw error;
      }
      const { start, end } = todayWindow();
      const [open] = await connection.execute(
        'SELECT id FROM attendance WHERE member_id=? AND check_out IS NULL LIMIT 1', [memberId]
      );
      if (open.length) {
        const error = new Error('Member is already checked in');
        error.status = 409;
        throw error;
      }
      const [today] = await connection.execute(
        'SELECT id FROM attendance WHERE member_id=? AND check_in>=? AND check_in<? LIMIT 1',
        [memberId, start, end]
      );
      if (today.length) {
        const error = new Error('This member has already used their one visit today.');
        error.status = 409;
        throw error;
      }
    }
    const [result] = await connection.execute(
      memberId
        ? 'INSERT INTO attendance(member_id,visit_limit_minutes) VALUES(?,?)'
        : 'INSERT INTO attendance(user_id,visit_limit_minutes) VALUES(?,?)',
      [memberId || userId, visitLimitMinutes || settings.member_visit_limit_minutes]
    );
    return result.insertId;
  });

export const todayWindow = () => localDay();

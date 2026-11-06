USE gym_management;

-- Before creating an index, check the plan for an attendance lookup by check-in time.
EXPLAIN
SELECT
    attendance_id,
    member_id,
    check_in_at,
    check_out_at
FROM attendance
WHERE check_in_at = '2026-09-29 18:10:00';

EXPLAIN ANALYZE
SELECT
    attendance_id,
    member_id,
    check_in_at,
    check_out_at
FROM attendance
WHERE check_in_at = '2026-09-29 18:10:00';

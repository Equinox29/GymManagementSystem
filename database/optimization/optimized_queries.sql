USE gym_management;

-- This index supports the attendance lookup shown in explain_queries.sql.
CREATE INDEX idx_attendance_check_in_at
ON attendance (check_in_at);

ANALYZE TABLE attendance;

-- Run the same query again and compare it with the earlier EXPLAIN output.
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

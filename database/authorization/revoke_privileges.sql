-- The front desk role should not be allowed to change an existing payment.
REVOKE UPDATE
ON gym_management.payments
FROM 'gym_staff_role';

SHOW GRANTS FOR 'gym_staff_role';

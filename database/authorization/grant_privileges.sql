GRANT SELECT, INSERT, UPDATE
ON gym_management.members
TO 'gym_staff_role';

GRANT SELECT
ON gym_management.membership_plans
TO 'gym_staff_role';

GRANT SELECT, INSERT, UPDATE
ON gym_management.member_memberships
TO 'gym_staff_role';

GRANT SELECT, INSERT, UPDATE
ON gym_management.payments
TO 'gym_staff_role';

GRANT SELECT, INSERT, UPDATE
ON gym_management.attendance
TO 'gym_staff_role';

GRANT 'gym_staff_role'
TO 'front_desk_rafael'@'localhost';

SET DEFAULT ROLE 'gym_staff_role'
TO 'front_desk_rafael'@'localhost';

SHOW GRANTS FOR 'gym_staff_role';
SHOW GRANTS FOR 'front_desk_rafael'@'localhost';

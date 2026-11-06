USE gym_management;

SHOW TABLES;

SELECT
    COUNT(*) AS table_count,
    GROUP_CONCAT(table_name ORDER BY table_name SEPARATOR ', ') AS table_names
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_type = 'BASE TABLE';

SELECT
    table_name,
    engine,
    table_collation
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

SELECT
    table_name,
    ordinal_position,
    column_name,
    column_type,
    is_nullable,
    column_default,
    extra
FROM information_schema.columns
WHERE table_schema = DATABASE()
ORDER BY table_name, ordinal_position;

SELECT
    table_name,
    column_name,
    column_type,
    extra
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND extra = 'auto_increment'
ORDER BY table_name, ordinal_position;

SELECT
    table_name,
    constraint_name,
    column_name,
    ordinal_position
FROM information_schema.key_column_usage
WHERE constraint_schema = DATABASE()
  AND constraint_name = 'PRIMARY'
ORDER BY table_name, ordinal_position;

SELECT
    kcu.table_name,
    kcu.constraint_name,
    kcu.column_name,
    kcu.referenced_table_name,
    kcu.referenced_column_name,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.key_column_usage AS kcu
INNER JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_schema = kcu.constraint_schema
    AND rc.table_name = kcu.table_name
    AND rc.constraint_name = kcu.constraint_name
WHERE kcu.constraint_schema = DATABASE()
  AND kcu.referenced_table_name IS NOT NULL
ORDER BY kcu.table_name, kcu.constraint_name, kcu.ordinal_position;

SELECT
    table_name,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE constraint_schema = DATABASE()
  AND constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY', 'CHECK')
ORDER BY table_name, constraint_type, constraint_name;

SELECT
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints AS tc
INNER JOIN information_schema.check_constraints AS cc
    ON cc.constraint_schema = tc.constraint_schema
    AND cc.constraint_name = tc.constraint_name
WHERE tc.constraint_schema = DATABASE()
  AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name, tc.constraint_name;

SELECT
    table_name,
    column_name,
    column_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'members'
  AND column_name = 'emergency_contact_phone_encrypted';

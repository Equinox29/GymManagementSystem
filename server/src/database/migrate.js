import { encryptContact, decryptContact } from '../services/fieldEncryption.js';

export const checks = [
  ['members', 'ck_member_age', 'age BETWEEN 1 AND 120'],
  [
    'members',
    'ck_member_names',
    'CHAR_LENGTH(TRIM(first_name)) > 0 AND CHAR_LENGTH(TRIM(last_name)) > 0'
  ],
  ['membership_plans', 'ck_membership_plan', 'duration > 0 AND price >= 0'],
  ['equipment_plans', 'ck_equipment_plan', 'duration > 0 AND price >= 0'],
  ['memberships', 'ck_membership_dates', 'end_date > start_date'],
  ['equipment_subscriptions', 'ck_subscription_dates', 'end_date > start_date'],
  ['payments', 'ck_payment_amount', 'amount > 0'],
  [
    'inventory_items',
    'ck_inventory_values',
    'quantity >= 0 AND unit_price >= 0 AND reorder_level >= 0'
  ],
  [
    'inventory_transactions',
    'ck_inventory_movement',
    "((type='archive' AND quantity >= 0) OR (type<>'archive' AND quantity > 0)) AND (unit_price IS NULL OR unit_price >= 0) AND (total_amount IS NULL OR total_amount >= 0)"
  ],
  ['attendance', 'ck_attendance_times', 'check_out IS NULL OR check_out >= check_in'],
  ['attendance', 'ck_visit_limit', 'visit_limit_minutes > 0'],
  ['gym_settings', 'ck_settings_limit', 'member_visit_limit_minutes > 0'],
  ['gym_settings', 'ck_settings_capacity', 'max_capacity > 0']
];
export async function migrate(c) {
  const [[paymentType]] = await c.query("SHOW COLUMNS FROM payments LIKE 'purchase_type'");
  if (!paymentType.Type.includes("'bundle'"))
    await c.query("ALTER TABLE payments MODIFY purchase_type ENUM('membership','equipment','bundle') NOT NULL DEFAULT 'membership'");
  const [[inventoryType]] = await c.query("SHOW COLUMNS FROM inventory_transactions LIKE 'type'");
  if (!inventoryType.Type.includes("'archive'"))
    await c.query("ALTER TABLE inventory_transactions MODIFY type ENUM('restock','sale','adjustment','damaged','archive') NOT NULL");
  const [[movementRule]] = await c.query(
    "SELECT CHECK_CLAUSE AS rule_text FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME='ck_inventory_movement'"
  );
  if (movementRule && !movementRule.rule_text.includes('archive'))
    await c.query('ALTER TABLE inventory_transactions DROP CHECK ck_inventory_movement');
  const [memberColumns] = await c.query("SHOW COLUMNS FROM members LIKE 'deleted_at'");
  if (!memberColumns.length) await c.query('ALTER TABLE members ADD deleted_at DATETIME NULL AFTER status');
  const [capacityColumns] = await c.query("SHOW COLUMNS FROM gym_settings LIKE 'max_capacity'");
  if (!capacityColumns.length)
    await c.query('ALTER TABLE gym_settings ADD max_capacity SMALLINT UNSIGNED NOT NULL DEFAULT 50 AFTER member_visit_limit_minutes');
  const [reviewColumns] = await c.query("SHOW COLUMNS FROM attendance LIKE 'overstay_reviewed_at'");
  if (!reviewColumns.length) {
    await c.query('ALTER TABLE attendance ADD overstay_reviewed_at DATETIME NULL AFTER check_out_reason');
    // Earlier visits predate the review workflow; do not create a backlog from old records.
    await c.query('UPDATE attendance SET overstay_reviewed_at=NOW() WHERE check_out IS NOT NULL');
  }
  // Stop if existing records break the new rules; leave them for review.
  for (const [table, name, expression] of checks) {
    const [[r]] = await c.query(`SELECT COUNT(*) n FROM ${table} WHERE NOT (${expression})`);
    if (r.n) throw new Error(`${name}: ${r.n} existing rows need review before migration`);
  }
  const [tables] = await c.query(
    "SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'"
  );
  for (const t of tables) {
    if (t.ENGINE !== 'InnoDB')
      throw new Error(`Review storage engine for ${t.TABLE_NAME}; InnoDB required`);
  }
  const [[column]] = await c.query(
    "SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='members' AND COLUMN_NAME='emergency_contact'"
  );
  if (column.DATA_TYPE !== 'text')
    await c.query('ALTER TABLE members MODIFY emergency_contact TEXT NULL');
  for (const [table, name, expression] of checks) {
    const [exists] = await c.execute(
      'SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_NAME=?',
      [table, name]
    );
    if (!exists.length)
      await c.query(`ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK (${expression})`);
  }
  const [indexes] = await c.query(
    "SHOW INDEX FROM memberships WHERE Key_name='idx_memberships_status_end'"
  );
  if (!indexes.length)
    await c.query('CREATE INDEX idx_memberships_status_end ON memberships(status,end_date)');
  const [inventoryDateIndex] = await c.query(
    "SHOW INDEX FROM inventory_transactions WHERE Key_name='idx_inventory_tx_type_date'"
  );
  if (!inventoryDateIndex.length)
    await c.query('CREATE INDEX idx_inventory_tx_type_date ON inventory_transactions(type,date)');
  await c.beginTransaction();
  try {
    const [rows] = await c.query(
      'SELECT id,emergency_contact FROM members WHERE emergency_contact IS NOT NULL FOR UPDATE'
    );
    for (const row of rows) {
      if (row.emergency_contact.startsWith('enc:v1:')) decryptContact(row.emergency_contact);
      else
        await c.execute('UPDATE members SET emergency_contact=? WHERE id=?', [
          encryptContact(row.emergency_contact),
          row.id
        ]);
    }
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  }
}

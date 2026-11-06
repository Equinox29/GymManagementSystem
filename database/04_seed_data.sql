USE gym_management;

INSERT INTO membership_plans (
    plan_name,
    duration_months,
    standard_fee,
    is_active
)
VALUES
    ('Monthly', 1, 1500.00, TRUE),
    ('Quarterly', 3, 4200.00, TRUE),
    ('Semi-Annual', 6, 7800.00, TRUE),
    ('Annual', 12, 14400.00, TRUE);

INSERT INTO staff (
    full_name,
    job_title,
    database_username,
    is_active
)
VALUES
    ('Lina Mercado', 'Gym Administrator', 'gym_admin', TRUE),
    ('Rafael Dela Cruz', 'Front Desk Staff', 'front_desk_rafael', TRUE),
    ('Nina Soriano', 'Front Desk Staff', 'front_desk_nina', TRUE),
    ('Paolo Reyes', 'Inventory Staff', 'inventory_paolo', TRUE),
    ('Celia Navarro', 'Gym Manager', 'gym_manager', TRUE);

INSERT INTO members (
    member_code,
    first_name,
    last_name,
    date_of_birth,
    phone,
    email,
    emergency_contact_name,
    emergency_contact_phone_encrypted,
    joined_at,
    is_active
)
VALUES
    ('GM-0001', 'Althea', 'Santos', '1995-04-12', '0917-555-0101', 'althea.santos@example.test', 'Ramon Santos', NULL, '2025-12-20 09:15:00', TRUE),
    ('GM-0002', 'Joaquin', 'Cruz', '1989-08-21', '0917-555-0102', 'joaquin.cruz@example.test', 'Mila Cruz', NULL, '2026-06-29 10:20:00', TRUE),
    ('GM-0003', 'Bianca', 'Garcia', '1998-01-30', '0917-555-0103', 'bianca.garcia@example.test', 'Noel Garcia', NULL, '2026-08-29 14:10:00', TRUE),
    ('GM-0004', 'Mateo', 'Flores', '1991-11-05', '0917-555-0104', 'mateo.flores@example.test', 'Iris Flores', NULL, '2026-06-12 08:45:00', TRUE),
    ('GM-0005', 'Danica', 'Ramos', '1987-06-18', '0917-555-0105', 'danica.ramos@example.test', 'Sofia Ramos', NULL, '2025-03-01 11:30:00', TRUE),
    ('GM-0006', 'Enzo', 'Castillo', '2000-09-09', '0917-555-0106', 'enzo.castillo@example.test', 'Lorenzo Castillo', NULL, '2025-10-29 16:00:00', TRUE),
    ('GM-0007', 'Kara', 'Domingo', '1994-02-14', '0917-555-0107', 'kara.domingo@example.test', 'Mina Domingo', NULL, '2025-09-12 09:05:00', FALSE),
    ('GM-0008', 'Theo', 'Manalo', '1996-12-27', '0917-555-0108', 'theo.manalo@example.test', 'Arman Manalo', NULL, '2026-05-28 13:40:00', FALSE),
    ('GM-0009', 'Yasmine', 'Torres', '1992-03-03', '0917-555-0109', 'yasmine.torres@example.test', 'Lila Torres', NULL, '2026-07-28 17:10:00', TRUE),
    ('GM-0010', 'Gabriel', 'Mendoza', '1988-10-16', '0917-555-0110', 'gabriel.mendoza@example.test', 'Pia Mendoza', NULL, '2026-08-12 10:00:00', TRUE),
    ('GM-0011', 'Selene', 'Aguirre', '1999-05-25', '0917-555-0111', 'selene.aguirre@example.test', 'Rico Aguirre', NULL, '2026-06-28 15:25:00', TRUE),
    ('GM-0012', 'Tristan', 'Velasco', '1990-07-07', '0917-555-0112', 'tristan.velasco@example.test', 'Mara Velasco', NULL, '2026-02-27 08:30:00', TRUE),
    ('GM-0013', 'Imani', 'Pascual', '1997-04-19', '0917-555-0113', 'imani.pascual@example.test', 'Cora Pascual', NULL, '2026-04-28 12:15:00', FALSE),
    ('GM-0014', 'Noel', 'Salazar', '1986-01-11', '0917-555-0114', 'noel.salazar@example.test', 'Toni Salazar', NULL, '2026-06-28 09:50:00', TRUE),
    ('GM-0015', 'Rina', 'Lopez', '2001-08-03', '0917-555-0115', 'rina.lopez@example.test', 'Berto Lopez', NULL, '2026-09-13 18:00:00', TRUE),
    ('GM-0016', 'Adrian', 'Chua', '1993-09-28', '0917-555-0116', 'adrian.chua@example.test', 'Grace Chua', NULL, '2026-03-30 11:05:00', TRUE),
    ('GM-0017', 'Mika', 'Valdez', '1998-06-06', '0917-555-0117', 'mika.valdez@example.test', 'Rene Valdez', NULL, '2026-03-29 14:35:00', TRUE),
    ('GM-0018', 'Dario', 'Quinto', '1995-02-22', '0917-555-0118', 'dario.quinto@example.test', 'Ana Quinto', NULL, '2026-08-30 16:45:00', TRUE);

INSERT INTO member_memberships (
    member_id,
    plan_id,
    start_date,
    end_date,
    amount_charged,
    status,
    created_at
)
VALUES
    (1, 4, '2026-01-01', '2026-12-31', 14400.00, 'active', '2025-12-20 09:20:00'),
    (2, 2, '2026-07-01', '2026-09-30', 4200.00, 'active', '2026-06-29 10:25:00'),
    (3, 1, '2026-09-01', '2026-09-30', 1500.00, 'active', '2026-08-29 14:15:00'),
    (4, 3, '2026-06-15', '2026-12-14', 7800.00, 'active', '2026-06-12 08:50:00'),
    (5, 4, '2025-03-01', '2026-02-28', 14400.00, 'expired', '2025-03-01 11:35:00'),
    (6, 1, '2025-11-01', '2025-11-30', 1500.00, 'expired', '2025-10-29 16:05:00'),
    (7, 2, '2025-09-15', '2025-12-14', 4200.00, 'expired', '2025-09-12 09:10:00'),
    (8, 1, '2026-06-01', '2026-06-30', 1500.00, 'cancelled', '2026-05-28 13:45:00'),
    (9, 3, '2026-08-01', '2027-01-31', 7800.00, 'active', '2026-07-28 17:15:00'),
    (10, 2, '2026-08-15', '2026-11-14', 4200.00, 'active', '2026-08-12 10:05:00'),
    (11, 1, '2026-07-01', '2026-07-31', 1500.00, 'expired', '2026-06-28 15:30:00'),
    (12, 4, '2026-03-01', '2027-02-28', 14400.00, 'active', '2026-02-27 08:35:00'),
    (13, 2, '2026-05-01', '2026-07-31', 4200.00, 'cancelled', '2026-04-28 12:20:00'),
    (14, 3, '2026-07-01', '2026-12-31', 7800.00, 'active', '2026-06-28 09:55:00'),
    (15, 1, '2026-09-15', '2026-10-14', 1500.00, 'active', '2026-09-13 18:05:00'),
    (16, 4, '2026-04-01', '2027-03-31', 14400.00, 'active', '2026-03-30 11:10:00'),
    (17, 2, '2026-04-01', '2026-06-30', 4200.00, 'expired', '2026-03-29 14:40:00'),
    (18, 1, '2026-09-01', '2026-09-30', 1500.00, 'active', '2026-08-30 16:50:00'),
    (1, 1, '2025-12-01', '2025-12-31', 1500.00, 'expired', '2025-11-28 09:20:00'),
    (3, 2, '2026-06-01', '2026-08-31', 4200.00, 'expired', '2026-05-29 14:15:00');

INSERT INTO payments (
    member_membership_id,
    amount,
    payment_method,
    payment_reference,
    payment_status,
    paid_at
)
VALUES
    (1, 10000.00, 'card', 'POS-2025-12020', 'paid', '2025-12-20 09:25:00'),
    (1, 4400.00, 'bank_transfer', 'BTR-2026-01005', 'paid', '2026-01-05 13:00:00'),
    (2, 4200.00, 'e_wallet', 'EW-2026-06291', 'paid', '2026-06-29 10:30:00'),
    (3, 1500.00, 'cash', NULL, 'paid', '2026-08-29 14:20:00'),
    (4, 4000.00, 'cash', NULL, 'paid', '2026-06-12 08:55:00'),
    (4, 3800.00, 'card', 'POS-2026-06125', 'paid', '2026-06-12 08:57:00'),
    (5, 14400.00, 'card', 'POS-2025-03001', 'paid', '2025-03-01 11:40:00'),
    (6, 1500.00, 'cash', NULL, 'paid', '2025-10-29 16:10:00'),
    (7, 4200.00, 'e_wallet', 'EW-2025-09121', 'paid', '2025-09-12 09:15:00'),
    (8, 1500.00, 'cash', NULL, 'refunded', '2026-05-28 13:50:00'),
    (9, 4000.00, 'bank_transfer', 'BTR-2026-07285', 'paid', '2026-07-28 17:20:00'),
    (9, 3800.00, 'card', 'POS-2026-08010', 'paid', '2026-08-01 09:10:00'),
    (10, 4200.00, 'e_wallet', 'EW-2026-08122', 'paid', '2026-08-12 10:10:00'),
    (10, 4200.00, 'card', 'POS-VOID-08123', 'voided', '2026-08-12 10:12:00'),
    (11, 1500.00, 'cash', NULL, 'paid', '2026-06-28 15:35:00'),
    (12, 14000.00, 'card', 'POS-2026-02270', 'paid', '2026-02-27 08:40:00'),
    (12, 400.00, 'bank_transfer', 'BTR-2026-03002', 'paid', '2026-03-02 09:00:00'),
    (13, 4200.00, 'e_wallet', 'EW-2026-04281', 'refunded', '2026-04-28 12:25:00'),
    (14, 4000.00, 'cash', NULL, 'paid', '2026-06-28 10:00:00'),
    (14, 3800.00, 'e_wallet', 'EW-2026-07001', 'paid', '2026-07-01 08:30:00'),
    (15, 1500.00, 'card', 'POS-2026-09131', 'paid', '2026-09-13 18:10:00'),
    (16, 7200.00, 'bank_transfer', 'BTR-2026-03301', 'paid', '2026-03-30 11:15:00'),
    (16, 7200.00, 'card', 'POS-2026-04001', 'paid', '2026-04-01 09:00:00'),
    (17, 4200.00, 'cash', NULL, 'paid', '2026-03-29 14:45:00'),
    (18, 1500.00, 'e_wallet', 'EW-2026-08301', 'paid', '2026-08-30 16:55:00'),
    (19, 1500.00, 'cash', NULL, 'paid', '2025-11-28 09:25:00'),
    (20, 4200.00, 'cash', NULL, 'paid', '2026-05-29 14:20:00');

INSERT INTO attendance (
    member_id,
    checked_in_by_staff_id,
    check_in_at,
    check_out_at
)
VALUES
    (1, 2, '2026-08-03 06:15:00', '2026-08-03 07:25:00'),
    (1, 3, '2026-08-10 18:10:00', '2026-08-10 19:20:00'),
    (1, 2, '2026-09-02 06:20:00', '2026-09-02 07:30:00'),
    (2, 3, '2026-08-05 17:45:00', '2026-08-05 18:50:00'),
    (2, 2, '2026-09-04 06:10:00', '2026-09-04 07:15:00'),
    (2, 3, '2026-09-18 18:00:00', '2026-09-18 19:10:00'),
    (3, 2, '2026-09-03 07:00:00', '2026-09-03 08:05:00'),
    (3, 3, '2026-09-11 17:20:00', '2026-09-11 18:30:00'),
    (3, 2, '2026-09-25 06:45:00', '2026-09-25 07:50:00'),
    (4, 3, '2026-08-04 18:30:00', '2026-08-04 19:40:00'),
    (4, 2, '2026-08-18 06:30:00', '2026-08-18 07:45:00'),
    (4, 3, '2026-09-09 18:15:00', '2026-09-09 19:25:00'),
    (9, 2, '2026-08-07 06:40:00', '2026-08-07 07:55:00'),
    (9, 3, '2026-08-21 17:50:00', '2026-08-21 19:00:00'),
    (9, 2, '2026-09-06 07:10:00', '2026-09-06 08:20:00'),
    (10, 3, '2026-08-19 18:05:00', '2026-08-19 19:15:00'),
    (10, 2, '2026-09-01 06:25:00', '2026-09-01 07:35:00'),
    (10, 3, '2026-09-22 17:40:00', '2026-09-22 18:50:00'),
    (12, 2, '2026-08-06 06:05:00', '2026-08-06 07:20:00'),
    (12, 3, '2026-08-27 18:20:00', '2026-08-27 19:35:00'),
    (12, 2, '2026-09-08 06:15:00', '2026-09-08 07:25:00'),
    (14, 3, '2026-08-11 17:35:00', '2026-08-11 18:45:00'),
    (14, 2, '2026-08-24 06:50:00', '2026-08-24 08:00:00'),
    (14, 3, '2026-09-14 18:10:00', '2026-09-14 19:20:00'),
    (15, 2, '2026-09-16 17:55:00', '2026-09-16 19:05:00'),
    (15, 3, '2026-09-23 06:35:00', '2026-09-23 07:40:00'),
    (16, 2, '2026-08-08 07:15:00', '2026-08-08 08:25:00'),
    (16, 3, '2026-08-29 18:25:00', '2026-08-29 19:35:00'),
    (16, 2, '2026-09-12 06:20:00', '2026-09-12 07:30:00'),
    (17, 3, '2026-06-04 18:00:00', '2026-06-04 19:10:00'),
    (17, 2, '2026-06-18 06:30:00', '2026-06-18 07:40:00'),
    (18, 3, '2026-09-05 07:05:00', '2026-09-05 08:15:00'),
    (18, 2, '2026-09-19 17:45:00', '2026-09-19 18:55:00'),
    (18, 3, '2026-09-29 18:10:00', NULL),
    (6, 2, '2025-11-08 08:00:00', '2025-11-08 09:05:00'),
    (11, 3, '2026-07-15 17:30:00', '2026-07-15 18:40:00');

INSERT INTO inventory_items (
    sku,
    item_name,
    category,
    quantity_on_hand,
    reorder_level,
    unit_cost,
    is_active
)
VALUES
    ('RET-PRO-001', 'Ready-to-Drink Protein Shake', 'retail_item', 36, 20, 48.00, TRUE),
    ('CLN-DIS-001', 'Disinfectant Concentrate', 'cleaning_supply', 8, 10, 185.00, TRUE),
    ('EQP-TWL-001', 'Microfiber Gym Towel', 'equipment_supply', 42, 25, 65.00, TRUE),
    ('RET-LCK-001', 'Combination Locker Padlock', 'retail_item', 6, 10, 130.00, TRUE),
    ('EQP-RBD-001', 'Resistance Band Set', 'equipment_supply', 18, 12, 220.00, TRUE),
    ('EQP-MAT-001', 'Yoga Mat', 'equipment_supply', 12, 10, 350.00, TRUE),
    ('RET-WTR-001', 'Bottled Water 500ml', 'retail_item', 24, 30, 18.00, TRUE),
    ('CLN-PPR-001', 'Paper Towel Roll', 'cleaning_supply', 16, 15, 32.00, TRUE),
    ('OTH-FAK-001', 'First Aid Kit Refill', 'other', 5, 5, 420.00, TRUE),
    ('RET-ELY-001', 'Electrolyte Sachet', 'retail_item', 14, 20, 28.00, TRUE),
    ('EQP-LUB-001', 'Treadmill Lubricant', 'equipment_supply', 3, 5, 175.00, TRUE),
    ('CLN-SAN-001', 'Hand Sanitizer Refill', 'cleaning_supply', 10, 12, 95.00, TRUE);

INSERT INTO inventory_transactions (
    inventory_item_id,
    staff_id,
    transaction_type,
    quantity_change,
    unit_cost,
    reference_note,
    occurred_at
)
VALUES
    (1, 4, 'stock_in', 60, 48.00, 'Opening retail stock delivery', '2026-08-01 09:00:00'),
    (1, 4, 'stock_out', -23, NULL, 'Counter sales and member purchases', '2026-08-31 20:00:00'),
    (1, 5, 'adjustment', -1, NULL, 'Damaged bottle removed from stock', '2026-09-05 10:15:00'),
    (2, 4, 'stock_in', 24, 185.00, 'Monthly sanitation supply delivery', '2026-08-01 09:10:00'),
    (2, 4, 'stock_out', -18, NULL, 'Cleaning room usage', '2026-08-31 20:10:00'),
    (2, 5, 'adjustment', 2, NULL, 'Count correction after storeroom review', '2026-09-04 11:00:00'),
    (3, 4, 'stock_in', 80, 65.00, 'Towel replacement delivery', '2026-08-02 09:00:00'),
    (3, 4, 'stock_out', -40, NULL, 'Member towel sales and replacements', '2026-08-31 20:20:00'),
    (3, 5, 'adjustment', 2, NULL, 'Recovered towels returned to inventory', '2026-09-03 14:20:00'),
    (4, 4, 'stock_in', 20, 130.00, 'Locker accessory delivery', '2026-08-02 09:10:00'),
    (4, 4, 'stock_out', -15, NULL, 'Retail padlock sales', '2026-08-31 20:30:00'),
    (4, 5, 'adjustment', 1, NULL, 'Inventory count correction', '2026-09-02 13:30:00'),
    (5, 4, 'stock_in', 30, 220.00, 'Training accessory delivery', '2026-08-03 09:00:00'),
    (5, 4, 'stock_out', -12, NULL, 'Member retail sales', '2026-08-31 20:40:00'),
    (6, 4, 'stock_in', 20, 350.00, 'Fitness floor equipment supply delivery', '2026-08-03 09:10:00'),
    (6, 4, 'stock_out', -8, NULL, 'Replacement mats issued to fitness floor', '2026-08-31 20:50:00'),
    (7, 4, 'stock_in', 100, 18.00, 'Beverage delivery', '2026-08-04 09:00:00'),
    (7, 4, 'stock_out', -80, NULL, 'Counter beverage sales', '2026-08-31 21:00:00'),
    (7, 5, 'adjustment', 4, NULL, 'Additional unopened cases counted', '2026-09-06 10:40:00'),
    (8, 4, 'stock_in', 40, 32.00, 'Cleaning supply delivery', '2026-08-04 09:10:00'),
    (8, 4, 'stock_out', -25, NULL, 'Facility cleaning usage', '2026-08-31 21:10:00'),
    (8, 5, 'adjustment', 1, NULL, 'Storeroom count correction', '2026-09-05 15:10:00'),
    (9, 4, 'stock_in', 8, 420.00, 'Safety supply delivery', '2026-08-05 09:00:00'),
    (9, 4, 'stock_out', -3, NULL, 'First aid station refill', '2026-08-31 21:20:00'),
    (10, 4, 'stock_in', 50, 28.00, 'Retail supplement delivery', '2026-08-05 09:10:00'),
    (10, 4, 'stock_out', -36, NULL, 'Counter retail sales', '2026-08-31 21:30:00'),
    (11, 4, 'stock_in', 12, 175.00, 'Maintenance supply delivery', '2026-08-06 09:00:00'),
    (11, 4, 'stock_out', -10, NULL, 'Treadmill maintenance usage', '2026-08-31 21:40:00'),
    (11, 5, 'adjustment', 1, NULL, 'Reserve bottle found during count', '2026-09-07 16:00:00'),
    (12, 4, 'stock_in', 30, 95.00, 'Hygiene supply delivery', '2026-08-06 09:10:00'),
    (12, 4, 'stock_out', -22, NULL, 'Lobby dispenser refills', '2026-08-31 21:50:00'),
    (12, 5, 'adjustment', 2, NULL, 'Unopened refill bottles counted', '2026-09-08 11:20:00');

SELECT COUNT(*) AS member_count FROM members;
SELECT COUNT(*) AS membership_plan_count FROM membership_plans;
SELECT COUNT(*) AS member_membership_count FROM member_memberships;
SELECT COUNT(*) AS payment_count FROM payments;
SELECT COUNT(*) AS staff_count FROM staff;
SELECT COUNT(*) AS attendance_count FROM attendance;
SELECT COUNT(*) AS inventory_item_count FROM inventory_items;
SELECT COUNT(*) AS inventory_transaction_count FROM inventory_transactions;

SELECT
    mm.member_membership_id,
    m.member_code,
    m.first_name,
    m.last_name,
    mp.plan_name,
    mm.start_date,
    mm.end_date,
    mm.amount_charged,
    mm.status
FROM member_memberships AS mm
INNER JOIN members AS m
    ON m.member_id = mm.member_id
INNER JOIN membership_plans AS mp
    ON mp.plan_id = mm.plan_id
ORDER BY mm.member_membership_id;

SELECT
    p.payment_id,
    p.member_membership_id,
    m.member_code,
    p.amount,
    p.payment_method,
    p.payment_reference,
    p.payment_status,
    p.paid_at
FROM payments AS p
INNER JOIN member_memberships AS mm
    ON mm.member_membership_id = p.member_membership_id
INNER JOIN members AS m
    ON m.member_id = mm.member_id
ORDER BY p.payment_id;

SELECT
    a.attendance_id,
    m.member_code,
    s.full_name AS checked_in_by,
    a.check_in_at,
    a.check_out_at
FROM attendance AS a
INNER JOIN members AS m
    ON m.member_id = a.member_id
LEFT JOIN staff AS s
    ON s.staff_id = a.checked_in_by_staff_id
ORDER BY a.check_in_at;

SELECT
    inventory_item_id,
    sku,
    item_name,
    quantity_on_hand,
    reorder_level,
    unit_cost
FROM inventory_items
ORDER BY inventory_item_id;

SELECT
    it.inventory_transaction_id,
    ii.sku,
    ii.item_name,
    s.full_name AS recorded_by,
    it.transaction_type,
    it.quantity_change,
    it.unit_cost,
    it.reference_note,
    it.occurred_at
FROM inventory_transactions AS it
INNER JOIN inventory_items AS ii
    ON ii.inventory_item_id = it.inventory_item_id
INNER JOIN staff AS s
    ON s.staff_id = it.staff_id
ORDER BY it.inventory_item_id, it.occurred_at;

SELECT
    ii.inventory_item_id,
    ii.sku,
    ii.item_name,
    ii.quantity_on_hand,
    COALESCE(SUM(it.quantity_change), 0) AS transaction_quantity,
    CASE
        WHEN ii.quantity_on_hand = COALESCE(SUM(it.quantity_change), 0) THEN 'consistent'
        ELSE 'inconsistent'
    END AS inventory_status
FROM inventory_items AS ii
LEFT JOIN inventory_transactions AS it
    ON it.inventory_item_id = ii.inventory_item_id
GROUP BY
    ii.inventory_item_id,
    ii.sku,
    ii.item_name,
    ii.quantity_on_hand
ORDER BY ii.inventory_item_id;

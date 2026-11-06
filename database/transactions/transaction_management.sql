USE gym_management;

-- Run this file after 04_seed_data.sql on a fresh database.
-- The seed data creates membership records 1 through 20.
-- Atomicity: related membership and payment records are committed together.
-- Consistency: inventory quantity and its transaction record are committed together.
-- Durability: changes before COMMIT remain saved; ROLLBACK cancels its change.

-- Membership sale: the membership and its payment are saved together.
START TRANSACTION;

INSERT INTO member_memberships (
    member_id,
    plan_id,
    start_date,
    end_date,
    amount_charged,
    status
)
VALUES (
    17,
    2,
    '2026-10-01',
    '2026-12-31',
    4200.00,
    'active'
);

INSERT INTO payments (
    member_membership_id,
    amount,
    payment_method,
    payment_reference,
    payment_status
)
VALUES (
    21,
    4200.00,
    'cash',
    NULL,
    'paid'
);

COMMIT;

SELECT
    mm.member_membership_id,
    mm.member_id,
    mm.plan_id,
    p.payment_id,
    p.amount,
    p.payment_status
FROM member_memberships AS mm
INNER JOIN payments AS p
    ON p.member_membership_id = mm.member_membership_id
WHERE mm.member_membership_id = 21;

-- Committed inventory update: both stock quantity and its history record are saved.
START TRANSACTION;

UPDATE inventory_items
SET quantity_on_hand = quantity_on_hand - 2
WHERE inventory_item_id = 7;

INSERT INTO inventory_transactions (
    inventory_item_id,
    staff_id,
    transaction_type,
    quantity_change,
    reference_note
)
VALUES (
    7,
    4,
    'stock_out',
    -2,
    'Gym counter sale'
);

COMMIT;

SELECT
    inventory_item_id,
    item_name,
    quantity_on_hand
FROM inventory_items
WHERE inventory_item_id = 7;

-- Rollback example: this temporary quantity change is cancelled.
START TRANSACTION;

UPDATE inventory_items
SET quantity_on_hand = quantity_on_hand - 5
WHERE inventory_item_id = 1;

ROLLBACK;

SELECT
    inventory_item_id,
    item_name,
    quantity_on_hand
FROM inventory_items
WHERE inventory_item_id = 1;

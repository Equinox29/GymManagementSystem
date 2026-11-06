USE gym_management;

CREATE TABLE members (
    member_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    member_code VARCHAR(20) NOT NULL,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80) NOT NULL,
    date_of_birth DATE NULL,
    phone VARCHAR(25) NOT NULL,
    email VARCHAR(255) NULL,
    emergency_contact_name VARCHAR(120) NULL,
    emergency_contact_phone_encrypted VARBINARY(255) NULL,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_members PRIMARY KEY (member_id),
    CONSTRAINT uq_members_member_code UNIQUE (member_code),
    CONSTRAINT uq_members_email UNIQUE (email),
    CONSTRAINT chk_members_is_active CHECK (is_active IN (0, 1))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE membership_plans (
    plan_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    plan_name VARCHAR(100) NOT NULL,
    duration_months TINYINT UNSIGNED NOT NULL,
    standard_fee DECIMAL(10, 2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_membership_plans PRIMARY KEY (plan_id),
    CONSTRAINT uq_membership_plans_plan_name UNIQUE (plan_name),
    CONSTRAINT chk_membership_plans_duration_months CHECK (duration_months > 0),
    CONSTRAINT chk_membership_plans_standard_fee CHECK (standard_fee >= 0),
    CONSTRAINT chk_membership_plans_is_active CHECK (is_active IN (0, 1))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE staff (
    staff_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(160) NOT NULL,
    job_title VARCHAR(80) NOT NULL,
    database_username VARCHAR(64) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_staff PRIMARY KEY (staff_id),
    CONSTRAINT uq_staff_database_username UNIQUE (database_username),
    CONSTRAINT chk_staff_is_active CHECK (is_active IN (0, 1))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE inventory_items (
    inventory_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sku VARCHAR(40) NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    category ENUM('equipment_supply', 'cleaning_supply', 'retail_item', 'other') NOT NULL,
    quantity_on_hand INT NOT NULL DEFAULT 0,
    reorder_level INT UNSIGNED NOT NULL DEFAULT 0,
    unit_cost DECIMAL(10, 2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_inventory_items PRIMARY KEY (inventory_item_id),
    CONSTRAINT uq_inventory_items_sku UNIQUE (sku),
    CONSTRAINT chk_inventory_items_quantity_on_hand CHECK (quantity_on_hand >= 0),
    CONSTRAINT chk_inventory_items_unit_cost CHECK (unit_cost >= 0),
    CONSTRAINT chk_inventory_items_is_active CHECK (is_active IN (0, 1))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE member_memberships (
    member_membership_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    member_id BIGINT UNSIGNED NOT NULL,
    plan_id BIGINT UNSIGNED NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    amount_charged DECIMAL(10, 2) NOT NULL,
    status ENUM('active', 'expired', 'cancelled') NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_member_memberships PRIMARY KEY (member_membership_id),
    CONSTRAINT fk_member_memberships_member
        FOREIGN KEY (member_id)
        REFERENCES members (member_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_member_memberships_plan
        FOREIGN KEY (plan_id)
        REFERENCES membership_plans (plan_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT chk_member_memberships_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_member_memberships_amount_charged CHECK (amount_charged >= 0)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE payments (
    payment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    member_membership_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method ENUM('cash', 'card', 'bank_transfer', 'e_wallet') NOT NULL,
    payment_reference VARCHAR(100) NULL,
    payment_status ENUM('paid', 'voided', 'refunded') NOT NULL DEFAULT 'paid',
    paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_payments PRIMARY KEY (payment_id),
    CONSTRAINT fk_payments_member_membership
        FOREIGN KEY (member_membership_id)
        REFERENCES member_memberships (member_membership_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT chk_payments_amount CHECK (amount > 0)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE attendance (
    attendance_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    member_id BIGINT UNSIGNED NOT NULL,
    checked_in_by_staff_id BIGINT UNSIGNED NULL,
    check_in_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    check_out_at DATETIME NULL,
    CONSTRAINT pk_attendance PRIMARY KEY (attendance_id),
    CONSTRAINT fk_attendance_member
        FOREIGN KEY (member_id)
        REFERENCES members (member_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_attendance_staff
        FOREIGN KEY (checked_in_by_staff_id)
        REFERENCES staff (staff_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT chk_attendance_check_out_at
        CHECK (check_out_at IS NULL OR check_out_at >= check_in_at)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE inventory_transactions (
    inventory_transaction_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    inventory_item_id BIGINT UNSIGNED NOT NULL,
    staff_id BIGINT UNSIGNED NOT NULL,
    transaction_type ENUM('stock_in', 'stock_out', 'adjustment') NOT NULL,
    quantity_change INT NOT NULL,
    unit_cost DECIMAL(10, 2) NULL,
    reference_note VARCHAR(255) NULL,
    occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_inventory_transactions PRIMARY KEY (inventory_transaction_id),
    CONSTRAINT fk_inventory_transactions_item
        FOREIGN KEY (inventory_item_id)
        REFERENCES inventory_items (inventory_item_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_inventory_transactions_staff
        FOREIGN KEY (staff_id)
        REFERENCES staff (staff_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT chk_inventory_transactions_quantity_change CHECK (quantity_change <> 0),
    CONSTRAINT chk_inventory_transactions_unit_cost
        CHECK (unit_cost IS NULL OR unit_cost >= 0)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

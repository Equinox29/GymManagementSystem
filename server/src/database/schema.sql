-- Create the gym tables and their rules. InnoDB supports saving or undoing transactions.

-- Create the database with support for names in different languages.
CREATE DATABASE IF NOT EXISTS `gym_management`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `gym_management`; -- Use this database for the commands below.

CREATE TABLE IF NOT EXISTS users (
  -- Give each account a unique ID.
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(120) NOT NULL UNIQUE,
  email VARCHAR(190) NOT NULL UNIQUE,
  -- Store the password hash used to check logins, never the original password.
  password VARCHAR(255) NOT NULL,
  -- Store the role that the API uses to check permissions.
  role ENUM('admin','staff','member') NOT NULL DEFAULT 'member',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS members (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL UNIQUE,
  first_name VARCHAR(120) NOT NULL, last_name VARCHAR(120) NOT NULL,
  age TINYINT UNSIGNED NOT NULL, email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(40) NULL,
  status ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
  deleted_at DATETIME NULL,
  suspension_until DATETIME NULL, suspension_reason VARCHAR(500) NULL,
  suspended_at DATETIME NULL, suspension_notice_seen_at DATETIME NULL,
  emergency_contact TEXT NULL, photo_url TEXT NULL,
  -- Store a hash to check invite codes without saving the original code.
  portal_invite_hash CHAR(64) NULL, portal_invite_expires_at DATETIME NULL,
  join_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Link an existing login; keep the member record if the login is deleted.
  CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  -- Help find members by status and list their names in order.
  INDEX idx_members_status_name(status,last_name,first_name),
  CONSTRAINT ck_member_age CHECK (age BETWEEN 1 AND 120),
  CONSTRAINT ck_member_names CHECK (CHAR_LENGTH(TRIM(first_name)) > 0 AND CHAR_LENGTH(TRIM(last_name)) > 0)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS membership_plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL, duration SMALLINT UNSIGNED NOT NULL,
  price DECIMAL(10,2) NOT NULL, type VARCHAR(40) NOT NULL DEFAULT 'account_membership',
  features JSON NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_membership_plan_name(name),
  CONSTRAINT ck_membership_plan CHECK (duration > 0 AND price >= 0)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS memberships (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  member_id BIGINT UNSIGNED NOT NULL, plan_id BIGINT UNSIGNED NOT NULL,
  start_date DATETIME NOT NULL, end_date DATETIME NOT NULL,
  status ENUM('active','expired','cancelled','expiring_soon') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(member_id) REFERENCES members(id), FOREIGN KEY(plan_id) REFERENCES membership_plans(id),
  -- Help find a member's memberships by expiry date.
  INDEX idx_memberships_member_date(member_id,end_date),
  INDEX idx_memberships_status_end(status,end_date),
  CONSTRAINT ck_membership_dates CHECK (end_date > start_date)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS equipment_plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL UNIQUE, duration SMALLINT UNSIGNED NOT NULL,
  duration_unit ENUM('day','month','year') NOT NULL, price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT ck_equipment_plan CHECK (duration > 0 AND price >= 0)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS equipment_subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  member_id BIGINT UNSIGNED NOT NULL, plan_id BIGINT UNSIGNED NOT NULL,
  start_date DATETIME NOT NULL, end_date DATETIME NOT NULL,
  status ENUM('active','expired','cancelled') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY(member_id) REFERENCES members(id), FOREIGN KEY(plan_id) REFERENCES equipment_plans(id),
  -- Help find a member's gym plans by expiry date.
  INDEX idx_subscriptions_member_date(member_id,end_date),
  CONSTRAINT ck_subscription_dates CHECK (end_date > start_date)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  member_id BIGINT UNSIGNED NOT NULL, membership_id BIGINT UNSIGNED NULL,
  plan_id BIGINT UNSIGNED NULL, equipment_subscription_id BIGINT UNSIGNED NULL,
  equipment_plan_id BIGINT UNSIGNED NULL,
  purchase_type ENUM('membership','equipment','bundle') NOT NULL DEFAULT 'membership',
  amount DECIMAL(10,2) NOT NULL, payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payment_method ENUM('cash','card','gcash','bank_transfer') NOT NULL DEFAULT 'cash',
  status ENUM('completed','pending','refunded','failed') NOT NULL DEFAULT 'completed',
  receipt_number VARCHAR(100) NULL, notes TEXT NULL,
  FOREIGN KEY(member_id) REFERENCES members(id), FOREIGN KEY(membership_id) REFERENCES memberships(id) ON DELETE SET NULL,
  FOREIGN KEY(plan_id) REFERENCES membership_plans(id) ON DELETE SET NULL,
  FOREIGN KEY(equipment_subscription_id) REFERENCES equipment_subscriptions(id) ON DELETE SET NULL,
  FOREIGN KEY(equipment_plan_id) REFERENCES equipment_plans(id) ON DELETE SET NULL,
  -- Help find payments by date or list one member's payment history.
  INDEX idx_payments_date(payment_date,status), INDEX idx_payments_member(member_id,payment_date),
  CONSTRAINT ck_payment_amount CHECK (amount > 0)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS gym_settings (
  setting_key VARCHAR(80) NOT NULL PRIMARY KEY,
  member_visit_limit_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 120,
  max_capacity SMALLINT UNSIGNED NOT NULL DEFAULT 50,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT ck_settings_limit CHECK (member_visit_limit_minutes > 0),
  CONSTRAINT ck_settings_capacity CHECK (max_capacity > 0)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS attendance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  member_id BIGINT UNSIGNED NULL, user_id BIGINT UNSIGNED NULL,
  check_in DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, check_out DATETIME NULL,
  visit_limit_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 120,
  check_out_reason ENUM('member','staff','admin','time_limit') NULL,
  overstay_reviewed_at DATETIME NULL,
  notes TEXT NULL,
  -- Keep the person's ID here until checkout; use NULL afterward.
  -- The unique keys prevent two open visits. The API checks the daily visit limit.
  open_member_id BIGINT UNSIGNED GENERATED ALWAYS AS (IF(check_out IS NULL,member_id,NULL)) STORED,
  open_user_id BIGINT UNSIGNED GENERATED ALWAYS AS (IF(check_out IS NULL,user_id,NULL)) STORED,
  FOREIGN KEY(member_id) REFERENCES members(id), FOREIGN KEY(user_id) REFERENCES users(id),
  -- Each visit must belong to a member or a staff/admin account, never both.
  CHECK ((member_id IS NULL) <> (user_id IS NULL)),
  UNIQUE KEY uq_attendance_open_member(open_member_id), UNIQUE KEY uq_attendance_open_user(open_user_id),
  -- Help find one member's visits or all visits on a date.
  INDEX idx_attendance_member_date(member_id,check_in), INDEX idx_attendance_date(check_in),
  CONSTRAINT ck_attendance_times CHECK (check_out IS NULL OR check_out >= check_in),
  CONSTRAINT ck_visit_limit CHECK (visit_limit_minutes > 0)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS inventory_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL, category ENUM('supplement','drink','other') NOT NULL,
  quantity INT NOT NULL DEFAULT 0, unit_price DECIMAL(10,2) NOT NULL,
  is_sellable BOOLEAN NOT NULL DEFAULT TRUE, reorder_level INT NOT NULL DEFAULT 5,
  supplier VARCHAR(180) NULL, image_url TEXT NULL, is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at DATETIME NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Help list items that have not been archived, ordered by name.
  INDEX idx_inventory_active_name(is_archived,name),
  CONSTRAINT ck_inventory_values CHECK (quantity >= 0 AND unit_price >= 0 AND reorder_level >= 0)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  type ENUM('restock','sale','adjustment','damaged','archive') NOT NULL,
  quantity INT NOT NULL, unit_price DECIMAL(10,2) NULL, total_amount DECIMAL(10,2) NULL,
  notes TEXT NULL, performed_by VARCHAR(120) NULL,
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Link each stock change to its item and help find its history by date.
  FOREIGN KEY(item_id) REFERENCES inventory_items(id), INDEX idx_inventory_tx_item_date(item_id,date),
  INDEX idx_inventory_tx_type_date(type,date),
  CONSTRAINT ck_inventory_movement CHECK (((type='archive' AND quantity >= 0) OR (type<>'archive' AND quantity > 0)) AND (unit_price IS NULL OR unit_price >= 0) AND (total_amount IS NULL OR total_amount >= 0))
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS equipment (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL, category VARCHAR(120) NULL, brand VARCHAR(120) NULL,
  purchase_date DATE NULL,
  condition_status ENUM('operational','needs_inspection','under_maintenance','out_of_order') NOT NULL DEFAULT 'operational',
  is_archived BOOLEAN NOT NULL DEFAULT FALSE, archived_at DATETIME NULL, location VARCHAR(180) NULL,
  -- Help list equipment that has not been archived, ordered by name.
  INDEX idx_equipment_active_name(is_archived,name)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, equipment_id BIGINT UNSIGNED NOT NULL,
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  type ENUM('routine','repair','inspection') NOT NULL,
  description TEXT NULL,
  priority ENUM('low','medium','high','critical') NOT NULL DEFAULT 'low',
  resolved_date DATETIME NULL, performed_by VARCHAR(120) NULL,
  status ENUM('open','in_progress','resolved') NOT NULL DEFAULT 'open',
  -- Deleting a database equipment row also deletes its logs.
  -- The app keeps both by marking equipment as archived instead.
  FOREIGN KEY(equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
  -- Help find maintenance reports for a machine by status.
  INDEX idx_maintenance_equipment(equipment_id,status)
) ENGINE=InnoDB;
-- Add the default visit limit only if no setting exists.
INSERT INTO gym_settings(setting_key,member_visit_limit_minutes)
VALUES('main',120) ON DUPLICATE KEY UPDATE setting_key=VALUES(setting_key);

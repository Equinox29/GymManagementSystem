# Gym Management System

A MySQL database project for managing gym members, membership plans, subscriptions, payments, attendance, staff, and inventory.

## Database design

The schema includes eight related tables: `members`, `membership_plans`, `member_memberships`, `payments`, `attendance`, `staff`, `inventory_items`, and `inventory_transactions`. Foreign keys and checks protect transaction consistency.

## What this project demonstrates

- Relational modeling with primary keys, foreign keys, unique constraints, and validation checks
- Sample data and verification queries
- Role-based database privileges
- Transactions for multi-step changes
- Index and query optimization examples
- A classroom encryption example for an emergency contact field

## Run locally

Use MySQL 8.0 or later. Execute `database/01_create_database.sql`, `database/02_create_tables.sql`, and `database/04_seed_data.sql` in that order. Run `database/verify_database.sql` to inspect the result. The other folders contain separate demonstrations and should be reviewed before execution.

The authorization and encryption examples contain `REPLACE_WITH_LOCAL_PASSWORD` and `REPLACE_WITH_LOCAL_DEMO_KEY` placeholders. Replace them only in a local copy with values appropriate to your environment. Do not commit real credentials. The names, contact details, and payment entries in the seed data are fictional classroom examples.

This repository contains SQL scripts and database examples, not a deployed web application.
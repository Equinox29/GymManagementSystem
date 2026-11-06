# Triple J Fitness Center Management System

A full-stack gym management application built with React, Express, and MySQL 8.

## Features

- Admin and staff dashboards for members, plans, billing, and attendance
- Member portal with recent visit history and a live visit timer
- Gym capacity and visit-limit rules, suspension review, and check-in controls
- Membership renewal and refund workflows
- Inventory sales and restocks with transaction history
- Equipment records and maintenance tickets
- Role-based API access and encrypted emergency contact fields

## Project structure

- `client/`: React and Vite user interface
- `server/`: Express API, MySQL schema, migrations, and services
- `scripts/`: local development launcher

## Local setup

Install dependencies with `npm install --prefix server` and `npm install --prefix client`. Configure a private local environment file with your own database connection, JWT secret, encryption key, and initial account passwords. Run `npm run db:setup` for a fresh MySQL 8 database, then `npm run dev` and open `http://localhost:5173`.

Do not commit local environment files, database backups, credentials, or actual member records.

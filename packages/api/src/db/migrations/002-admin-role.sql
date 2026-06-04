-- Migration 002: Add role column to users table
-- Apply: wrangler d1 migrations apply butchi-db --remote

ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';

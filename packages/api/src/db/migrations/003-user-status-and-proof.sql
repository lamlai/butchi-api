-- Add status column to users table
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';

-- Add proof_url column to topup_records table
ALTER TABLE topup_records ADD COLUMN proof_url TEXT;

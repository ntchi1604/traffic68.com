-- Migration: Add service_type column to users table
-- Run this on your production database to support buyer/worker separation

ALTER TABLE users ADD COLUMN service_type VARCHAR(20) NOT NULL DEFAULT 'traffic' AFTER role;

-- Update existing users: set all current users as 'traffic' (buyer) by default
-- You can manually update specific users to 'shortlink' (worker) if needed:
-- UPDATE users SET service_type = 'shortlink' WHERE id IN (...);

-- Migration to add GSTIN and FSSAI fields to branches table
-- This supports branch-level compliance metadata in mobile and web apps

ALTER TABLE branches 
  ADD COLUMN IF NOT EXISTS gstin text,
  ADD COLUMN IF NOT EXISTS fssai_no text;

-- Add descriptions for the new columns
COMMENT ON COLUMN branches.gstin IS 'Goods and Services Tax Identification Number for the branch';
COMMENT ON COLUMN branches.fssai_no IS 'Food Safety and Standards Authority of India license number';

-- Migration to ensure all Branch Metadata fields exist
-- This supports the Branch Details screen in the mobile app

ALTER TABLE branches 
  ADD COLUMN IF NOT EXISTS address text,    -- Ensuring address exists (core field)
  ADD COLUMN IF NOT EXISTS gstin text,      -- New compliance field
  ADD COLUMN IF NOT EXISTS fssai_no text;   -- New compliance field

-- Add/Update descriptions
COMMENT ON COLUMN branches.address IS 'Physical street address of the branch';
COMMENT ON COLUMN branches.gstin IS 'Goods and Services Tax Identification Number (15-digit)';
COMMENT ON COLUMN branches.fssai_no IS 'Food Safety and Standards Authority of India license number (14-digit)';
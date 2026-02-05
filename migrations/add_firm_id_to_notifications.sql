-- Add firm_id column to notifications table
ALTER TABLE notifications 
ADD COLUMN firm_id uuid REFERENCES firms(id);

-- Backfill legacy rows with a default firm_id
-- NOTE: Replace 'fe718c27-0a4d-4962-9f56-94aada0cf336' with your actual default firm_id
UPDATE notifications 
SET firm_id = 'fe718c27-0a4d-4962-9f56-94aada0cf336' 
WHERE firm_id IS NULL;

-- Make the column NOT NULL after backfilling
-- ALTER TABLE notifications 
-- ALTER COLUMN firm_id SET NOT NULL;

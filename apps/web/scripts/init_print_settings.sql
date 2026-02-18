-- Initialize default printing settings for all branches
INSERT INTO settings (restaurant_id, branch_id, key, value)
SELECT 
    b.restaurant_id,
    b.id as branch_id,
    'printing' as key,
    '{
        "printerIdKot": "kitchen-1",
        "printerIdInvoice": "billing-1",
        "widthKot": 80,
        "widthInvoice": 80
    }'::jsonb as value
FROM branches b
ON CONFLICT (restaurant_id, branch_id, key) 
DO NOTHING;

-- If you want to force update existing settings, uncomment the line below:
-- DO UPDATE SET value = EXCLUDED.value;

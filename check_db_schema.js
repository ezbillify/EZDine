
const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: './apps/web/.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSchema() {
    const tables = ['menu_items', 'order_items', 'bills'];

    for (const table of tables) {
        const { data, error } = await supabase.rpc('get_table_columns', { table_name: table });
        if (error) {
            // If RPC doesn't exist, try a simple select to see what's there
            console.log(`Checking ${table} via select limit 0...`);
            const { data: cols, error: err } = await supabase.from(table).select('*').limit(0);
            if (err) {
                console.error(`Error checking ${table}:`, err.message);
            } else {
                console.log(`Columns for ${table}:`, Object.keys(cols?.[0] || {}));
            }
        } else {
            console.log(`Columns for ${table}:`, data);
        }
    }
}

// Since I don't know if get_table_columns exists, I'll just use a direct query to information_schema if possible, 
// but Supabase usually restricts that. Simple select * limit 0 is safer.
checkSchema();

# Supabase Setup (Part 2)

## Order of execution
1. `00_schema.sql`
2. `01_rls.sql`
3. `02_bootstrap.sql`
4. `03_core_tables.sql`
5. `04_rls_core.sql`
6. `05_multi_restaurant.sql`
7. `06_rls_multi_restaurant.sql`
8. `07_migrate_existing.sql`
9. `08_indexes.sql`
10. `09_user_profiles_email.sql`
11. `10_profiles_rls.sql`
12. `11_indexes_profiles.sql`
13. `12_settings_printing.sql`
14. `13_owner_functions.sql`
15. `14_transfer_ownership.sql`
16. `15_audit_logs_role_changes.sql`
17. `16_fix_rls_recursion.sql`
18. `17_doc_numbering.sql`
19. `18_doc_numbering_settings.sql`
20. `19_order_item_status.sql`

## Notes
- RLS policies allow restaurant-level roles to monitor all branches.
- Branch-level roles are limited to their branch.
- `user_profiles.active_branch_id` stores a user's currently selected branch.

## Next
Later parts will add business tables and stricter policies per module.

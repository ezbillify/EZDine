# Offline Sync Strategy

## Web
- Cache reads in IndexedDB.
- Queue writes in an outbox table (local), replay when online.
- Conflict resolution: server last-write-wins; keep conflict records for manual merge.

## Mobile (Flutter)
- Use SQLite/Hive for local cache.
- Background sync at interval + on connectivity changes.
- Use device_id + sync_version for idempotent writes.

## Server Rules
- Every mutable row should include `updated_at`.
- Clients send `client_updated_at` to resolve conflicts.

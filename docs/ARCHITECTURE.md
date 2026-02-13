# Architecture Overview

## Goals
- Offline-first, low-latency operations
- Multi-tenant, multi-branch isolation
- Real-time sync across devices
- Touch-first UX for staff

## High-Level Structure
- Web app: Next.js (admin, POS, manager, analytics)
- Mobile app: Flutter (POS + KDS + waiter flows)
- Backend: Supabase (Postgres + Auth + Realtime + Storage)
- Shared: Types, constants, and utility logic

## Data Principles
- Row Level Security scoped by `restaurant_id` and `branch_id`
- Audit logs for critical mutations
- Soft deletes where required

## Offline Strategy (planned)
- Web: IndexedDB cache + background sync queue
- Mobile: Hive/SQLite cache + background sync queue
- Conflict resolution: server timestamps + last-write-wins overrides

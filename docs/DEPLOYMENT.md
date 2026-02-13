# Deployment

## Web (Next.js)
- Configure env vars in hosting provider.
- Build: `pnpm build:web`
- Start: `pnpm --filter @ezdine/web start`

## Supabase
- Run SQL files in `docs/supabase` in order.
- Configure Auth redirect URLs for `/login` and `/dashboard`.

## Printing
- Web: use WebUSB/WebBluetooth with supported thermal printers (future).
- Mobile: integrate native printer SDKs.

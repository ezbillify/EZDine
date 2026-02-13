# EZDine Print Server

Local print server for ESC/POS thermal printers (USB + LAN).

## Setup
1. `cp config.example.json config.json`
2. Edit printer IP/USB config in `config.json`
3. `pnpm install` (or `npm install`)
4. `pnpm start`

## Configure Web App
Set `NEXT_PUBLIC_PRINT_SERVER_URL` to `http://<local-ip>:4001`.

## API
POST `/print` with `printerId`, `lines`.

# Printing (Local Print Server)

## Why a local print server
Web browsers are not reliable for direct USB/LAN printing in production. A local server on the cashier PC provides stable ESC/POS printing for KOT + invoices.

## Expected Print Server API
Base URL: `NEXT_PUBLIC_PRINT_SERVER_URL`

### POST /print
Request body:
```
{
  "printerId": "kitchen-1",
  "width": 58,
  "type": "kot", // "invoice"
  "lines": [
    { "text": "EZDine", "align": "center", "bold": true },
    { "text": "Table: T2", "align": "left" },
    { "text": "Paneer Butter Masala x1", "align": "left" },
    { "text": "----", "align": "center" }
  ]
}
```

Response:
```
{ "status": "ok" }
```

## Printer setup
- USB or LAN ESC/POS printers (58mm or 80mm)
- Each printer registered with a `printerId`

## Implementation notes
- KOT uses 58mm by default
- Invoice uses 80mm when available
- Use retry + queue on network failure

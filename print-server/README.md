# EZDine Print Server

A simple print server for the EZDine POS system that receives print jobs from the web application and displays them in the console.

## Quick Start

1. **Install dependencies:**
```bash
npm install
```

2. **Start the server:**
```bash
npm start
```

3. **Configure EZDine:**
   - Go to Settings > Printing Setup
   - Set Print Server URL to: `http://localhost:8080`
   - Click "Test Server" to verify connection
   - Click "Test Print" to send a test job

## Features

- ✅ **Health Check** - `/health` endpoint for connectivity testing
- 🖨️ **Print Jobs** - `/print` endpoint receives and displays print jobs
- 📋 **Job History** - `/jobs` endpoint shows recent print jobs
- 🗑️ **Clear History** - `DELETE /jobs` clears job history
- 🔍 **Detailed Logging** - Beautiful console output for all print jobs
- ⚡ **Fast Response** - Immediate acknowledgment of print jobs

## API Endpoints

### GET /health
Check if the server is running
```json
{
  "status": "ok",
  "message": "EZDine Print Server is running",
  "timestamp": "2026-03-01T14:30:00.000Z",
  "totalJobs": 5
}
```

### POST /print
Send a print job
```json
{
  "printerId": "kitchen-printer",
  "width": 80,
  "type": "invoice",
  "lines": [
    { "text": "EZDine Restaurant", "align": "center", "bold": true },
    { "text": "Order #123", "align": "center" }
  ]
}
```

### GET /jobs
View recent print jobs (last 10)

### DELETE /jobs
Clear all print job history

## Console Output

When a print job is received, you'll see:
```
🖨️ ================================
📄 PRINT JOB RECEIVED
🕐 Time: 3/1/2026, 2:30:00 PM
🖨️ Printer ID: kitchen-printer
📏 Paper Width: 80mm
📋 Print Type: INVOICE
🔢 Job #: 1
================================
📝 CONTENT:
    EZDine Restaurant (BOLD)
    Order #123
    --------------------------------
    2 x Burger                 20.00
    1 x Fries                  5.00
    --------------------------------
        TOTAL: 25.00 (BOLD)
================================
✅ Print job processed successfully
🔄 Total jobs processed: 1
================================
```

## Development

For development with auto-restart:
```bash
npm run dev
```

## Integration with Real Printers

This is a mock server for testing. To connect to real thermal printers:

1. **Install printer drivers** on the server machine
2. **Use thermal printer libraries** like:
   - `node-thermal-printer`
   - `escpos`
   - `node-printer`
3. **Replace the console.log** with actual printer commands
4. **Handle printer errors** and status

## Troubleshooting

### "Cannot connect to print server"
- Make sure the server is running (`npm start`)
- Check the URL in EZDine settings matches `http://localhost:8080`
- Verify no firewall is blocking port 8080

### "Print server timeout"
- Server may be overloaded
- Check server console for errors
- Restart the server

### No print jobs appearing
- Check EZDine printer settings are saved
- Verify print server URL is correct
- Look for errors in browser console

## Production Deployment

For production use:
1. **Use PM2** or similar process manager
2. **Set up proper logging** to files
3. **Configure reverse proxy** (nginx)
4. **Use environment variables** for configuration
5. **Add authentication** if needed
6. **Connect to actual printers**
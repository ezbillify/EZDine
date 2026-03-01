# Print Server Setup Guide

## The Issue
The printing system is trying to connect to a print server but it's not running. You need a print server/bridge to connect the web app to your thermal printers.

## Quick Solutions

### Option 1: Use a Simple Print Server (Recommended)
Create a simple Node.js print server:

1. **Create a new folder** for your print server:
```bash
mkdir print-server
cd print-server
npm init -y
npm install express cors
```

2. **Create `server.js`**:
```javascript
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Print server is running' });
});

// Print endpoint
app.post('/print', (req, res) => {
  console.log('Print job received:', req.body);
  
  // Here you would normally send to actual printer
  // For now, just log and return success
  console.log('Printer ID:', req.body.printerId);
  console.log('Paper Width:', req.body.width);
  console.log('Print Type:', req.body.type);
  console.log('Lines to print:');
  req.body.lines.forEach((line, i) => {
    console.log(`${i + 1}: ${line.text} (${line.align || 'left'})`);
  });
  
  res.json({ success: true, message: 'Print job sent to printer' });
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Print server running on http://localhost:${PORT}`);
  console.log('Ready to receive print jobs from EZDine web app');
});
```

3. **Run the server**:
```bash
node server.js
```

### Option 2: Test Without Actual Printing
If you just want to test the web app without actual printing:

1. **Use the mock server above** - it will log print jobs to console
2. **Configure printer settings** in the web app with `http://localhost:8080`
3. **Test printing** - you'll see the print jobs in the server console

### Option 3: Connect to Real Printers
For actual thermal printer integration, you'll need:

1. **Thermal printer drivers** installed on the server machine
2. **Printer connection** (USB, Network, or Bluetooth)
3. **Print server that can send ESC/POS commands** to the printer

Popular options:
- **node-thermal-printer** npm package
- **escpos** npm package  
- **Custom print server** using system print commands

## Testing the Setup

1. **Start your print server** (Option 1 above)
2. **Go to EZDine Settings > Printing Setup**
3. **Set Print Server URL** to `http://localhost:8080`
4. **Click "Test Server"** - should show "Print server is reachable"
5. **Click "Test Print"** - should show success and log in server console
6. **Try POS printing** - orders should print to server console

## Common Issues

### "Cannot connect to print server"
- Print server is not running
- Wrong URL in settings
- Firewall blocking connection

### "Print server timeout"
- Server is slow to respond
- Network connectivity issues
- Server crashed or hung

### "Print server error (500)"
- Server code has bugs
- Printer connection issues
- Invalid print job format

## Production Setup

For production, you'll want:
1. **Dedicated print server** machine near printers
2. **Proper thermal printer drivers**
3. **Network printer setup** or USB connections
4. **Error handling and logging**
5. **Auto-restart on crashes**

The mock server above is perfect for testing the web app functionality!
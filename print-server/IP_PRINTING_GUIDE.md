# IP Printing Setup Guide for EZDine

## 🎯 Direct IP Printing to Thermal Printers

This guide shows you how to print directly to thermal printers using their IP address, bypassing the need for drivers or print servers.

## 🔧 Setup Steps

### Step 1: Find Your Printer's IP Address

**Method 1: Print Network Configuration**
- Most thermal printers can print their network settings
- Look for a button combination or menu option to print network info
- Common combinations: Hold FEED button while powering on

**Method 2: Check Router/Network Admin Panel**
- Log into your router's admin panel
- Look for connected devices
- Find your printer in the device list

**Method 3: Use Network Scanner**
- Use tools like `nmap` or network scanner apps
- Scan your network range (e.g., 192.168.1.1-254)
- Look for devices on port 9100 (standard thermal printer port)

### Step 2: Test Printer Connectivity

```bash
cd print-server
python3 test_ip_printer.py 192.168.1.100
```

Replace `192.168.1.100` with your printer's actual IP address.

**Expected Output (Success):**
```
🖨️ EZDine IP Printer Test
==============================
Target IP: 192.168.1.100
Port: 9100 (standard thermal printer port)

🧪 Starting printer test...
🔌 Connecting to printer at 192.168.1.100:9100
✅ Connected to printer
📤 Sent 156 bytes to printer
🔌 Connection closed
✅ Print job sent successfully to 192.168.1.100

🎉 SUCCESS!
✅ Your thermal printer is working with IP printing
✅ You can now use this IP in EZDine printer settings
```

### Step 3: Configure EZDine Web App

1. **Start the print server:**
```bash
cd print-server
python3 server.py
```

2. **Configure EZDine:**
   - Go to **Settings > Printing Setup**
   - Set **Print Server URL** to: `http://localhost:8080`
   - Select **Connection Method**: `IP Address`
   - Enter **IP Address**: `192.168.1.100` (your printer's IP)
   - Set **Paper Width**: `58mm` or `80mm` (match your printer)
   - Click **Save Settings**

3. **Test the setup:**
   - Click **Test Server** - should show "Print server is reachable"
   - Click **Test Print** - should print to your thermal printer!

### Step 4: Test from POS System

1. Go to the POS system
2. Add items to cart
3. Complete an order
4. The receipt should print directly to your thermal printer!

## 🖨️ What Happens During IP Printing

When you use IP printing:

1. **EZDine Web App** → Sends print job to print server
2. **Print Server** → Detects IP address in printer ID
3. **IP Printer Module** → Converts print lines to ESC/POS commands
4. **TCP Socket** → Sends raw ESC/POS data to printer IP:9100
5. **Thermal Printer** → Receives and prints the data

## 🧪 Testing Different Scenarios

### Test 1: Basic Connectivity
```bash
python3 test_ip_printer.py 192.168.1.100
```

### Test 2: Manual Print Job
```bash
python3 ip_printer.py 192.168.1.100
```

### Test 3: Web App Integration
1. Start server: `python3 server.py`
2. Configure EZDine with IP address
3. Use "Test Print" button
4. Check server console for IP printing messages

## 🔍 Troubleshooting

### "Cannot reach printer at IP address"
- ✅ Check printer is powered on
- ✅ Verify IP address is correct
- ✅ Ensure printer is connected to same network
- ✅ Try pinging the printer: `ping 192.168.1.100`

### "Connection refused"
- ✅ Printer may not support network printing
- ✅ Port 9100 might be blocked or disabled
- ✅ Try different port numbers (9100, 515, 631)

### "Print job sent but nothing prints"
- ✅ Printer may not support ESC/POS commands
- ✅ Check printer manual for supported command sets
- ✅ Verify paper is loaded correctly
- ✅ Check printer status (errors, paper out, etc.)

### "Timeout errors"
- ✅ Network latency issues
- ✅ Printer is busy with other jobs
- ✅ Increase timeout in ip_printer.py

## 📋 Supported Printer Features

The IP printing module supports:
- ✅ **Text printing** with UTF-8 encoding
- ✅ **Text alignment** (left, center, right)
- ✅ **Bold text** formatting
- ✅ **Paper cutting** (partial cut)
- ✅ **Multiple paper widths** (58mm, 80mm)
- ✅ **ESC/POS commands** (industry standard)

## 🔧 Advanced Configuration

### Custom Port Numbers
Edit `ip_printer.py` and change the default port:
```python
def __init__(self, ip_address: str, port: int = 9100, timeout: int = 10):
```

### Additional ESC/POS Commands
Add more commands to `ESCPOSCommands` class:
```python
# Font sizes
FONT_A = ESC + b'M\x00'  # 12x24 dots
FONT_B = ESC + b'M\x01'  # 9x17 dots

# Underline
UNDERLINE_ON = ESC + b'-\x01'
UNDERLINE_OFF = ESC + b'-\x00'
```

### Multiple Printer Support
The system can handle multiple IP printers by using different IP addresses as printer IDs in EZDine settings.

## 🎉 Success Indicators

You'll know IP printing is working when:
1. ✅ Test script shows "SUCCESS!"
2. ✅ EZDine "Test Print" button works
3. ✅ Server console shows "✅ Successfully printed to IP printer"
4. ✅ Physical receipt prints from thermal printer
5. ✅ POS orders print automatically

## 📞 Common Printer IP Ranges

Most networks use these IP ranges:
- `192.168.1.x` (home/small office)
- `192.168.0.x` (alternative home range)
- `10.0.0.x` (corporate networks)
- `172.16.x.x` (corporate networks)

Check your computer's IP to determine the range:
```bash
ifconfig | grep inet
```

Your printer will likely be in the same range!
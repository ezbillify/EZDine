# EZDine Print Bridge

Print bridge for EZDine POS system. Connects your web application to thermal printers.

## 📦 What's Included

- `server.py` - Main print bridge server
- `ip_printer.py` - IP printer support module
- `start-macos.command` - macOS launcher
- `start-windows.bat` - Windows launcher
- `setup-autostart-macos.command` - macOS auto-start setup
- `setup-autostart-windows.bat` - Windows auto-start setup

## 🚀 Quick Start

### macOS
1. Double-click `start-macos.command`
2. If blocked, right-click → Open → Open
3. Print bridge will start

### Windows
1. Double-click `start-windows.bat`
2. Print bridge will start

## ⚙️ Auto-Start Setup

### macOS
1. Double-click `setup-autostart-macos.command`
2. Print bridge will start automatically on login

### Windows
1. Right-click `setup-autostart-windows.bat`
2. Select "Run as administrator"
3. Print bridge will start automatically on Windows startup

## 🔧 Configuration

Once running, configure EZDine:
1. Go to **Settings > Printing Setup**
2. Set **Print Server URL**: `http://localhost:8080`
3. Choose connection method and configure printer
4. Save and test!

## 📋 Features

- ✅ Receives print jobs from EZDine web app
- ✅ Supports IP address printing (direct to thermal printer)
- ✅ Console logging of all print jobs
- ✅ Auto-restart on crash (when using auto-start)
- ✅ Runs in background
- ✅ Cross-platform (macOS & Windows)

## 🔍 Troubleshooting

### Print bridge won't start
- **macOS**: Make sure Python 3 is installed (`python3 --version`)
- **Windows**: Make sure Python is installed (`python --version`)

### Can't connect from EZDine
- Check print bridge is running
- Verify URL is `http://localhost:8080`
- Check firewall isn't blocking port 8080

### IP printing not working
- Verify printer IP address is correct
- Ensure printer is on same network
- Test with: `http://localhost:8080/test-ip/YOUR_PRINTER_IP`

## 📞 Support

For issues or questions, check the EZDine documentation or contact support.

## 🔄 Version

Version: 1.0.0
Last Updated: March 2026
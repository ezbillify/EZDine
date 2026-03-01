# EZDine Print Bridge - macOS Installation

## Quick Start (2 Minutes)

### Step 1: Download
Download the `print-server` folder to your Mac.

### Step 2: Open Terminal
- Press `Cmd + Space`
- Type "Terminal"
- Press Enter

### Step 3: Navigate to Folder
```bash
cd ~/Downloads/print-server
# Or wherever you saved it
```

### Step 4: Start Print Bridge
```bash
python3 server.py
```

You'll see:
```
🚀 ================================
🖨️  EZDINE PRINT SERVER STARTED
================================
🌐 Server URL: http://localhost:8080
```

### Step 5: Configure EZDine
1. Open EZDine web app
2. Go to Settings > Printing Setup
3. Set Print Server URL: `http://localhost:8080`
4. Save and test!

## Keep It Running

The print bridge needs to stay running while you use EZDine.

**Don't close the Terminal window!**

## Auto-Start on Login (Optional)

Create a simple app to start automatically:

1. Open **Automator**
2. Create new **Application**
3. Add **Run Shell Script** action
4. Paste:
```bash
cd ~/Downloads/print-server
python3 server.py
```
5. Save as "EZDine Print Bridge"
6. Add to Login Items in System Settings

Done! ✅
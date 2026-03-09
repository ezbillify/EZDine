#!/bin/bash
# Setup EZDine Print Bridge to auto-start on macOS login

echo "🖨️  EZDine Print Bridge - Auto-Start Setup"
echo "=========================================="
echo ""

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Create LaunchAgent plist file
PLIST_FILE="$HOME/Library/LaunchAgents/com.ezdine.printbridge.plist"

echo "Creating launch agent..."

cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ezdine.printbridge</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>$DIR/server.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME/Library/Logs/ezdine-printbridge.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/ezdine-printbridge-error.log</string>
</dict>
</plist>
EOF

# Load the launch agent
launchctl load "$PLIST_FILE"

echo ""
echo "✅ Auto-start setup complete!"
echo ""
echo "The print bridge will now:"
echo "  • Start automatically when you log in"
echo "  • Restart automatically if it crashes"
echo "  • Run in the background"
echo ""
echo "Logs are saved to:"
echo "  $HOME/Library/Logs/ezdine-printbridge.log"
echo ""
echo "To disable auto-start, run:"
echo "  launchctl unload $PLIST_FILE"
echo ""
echo "Press any key to exit..."
read -n 1
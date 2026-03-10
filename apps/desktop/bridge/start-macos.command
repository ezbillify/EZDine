#!/bin/bash
# EZDine Print Bridge - macOS Launcher

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Clear screen and show banner
clear
echo "🖨️  ================================"
echo "   EZDINE PRINT BRIDGE"
echo "   ================================"
echo ""
echo "   Starting print bridge..."
echo ""

# Start the server
./ezdine-print-bridge-macos 4000

# Keep terminal open if there's an error
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Error starting print bridge"
    echo "Press any key to exit..."
    read -n 1
fi
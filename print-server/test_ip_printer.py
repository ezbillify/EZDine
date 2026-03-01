#!/usr/bin/env python3
"""
Quick IP Printer Test Script
Test your thermal printer's IP connectivity and printing
"""

import sys
from ip_printer import test_ip_printer, print_to_ip_printer

def main():
    if len(sys.argv) < 2:
        print("🖨️ EZDine IP Printer Test")
        print("=" * 30)
        print("Usage: python3 test_ip_printer.py <printer_ip>")
        print("Example: python3 test_ip_printer.py 192.168.1.100")
        print("")
        print("This will:")
        print("1. Test connection to the printer")
        print("2. Send a test print job")
        print("3. Show results")
        sys.exit(1)
    
    printer_ip = sys.argv[1]
    
    print("🖨️ EZDine IP Printer Test")
    print("=" * 30)
    print(f"Target IP: {printer_ip}")
    print(f"Port: 9100 (standard thermal printer port)")
    print("")
    
    # Test the printer
    print("🧪 Starting printer test...")
    success = test_ip_printer(printer_ip)
    
    if success:
        print("")
        print("🎉 SUCCESS!")
        print("✅ Your thermal printer is working with IP printing")
        print("✅ You can now use this IP in EZDine printer settings")
        print("")
        print("Next steps:")
        print("1. Go to EZDine Settings > Printing Setup")
        print("2. Select 'IP Address' connection method")
        print(f"3. Enter IP address: {printer_ip}")
        print("4. Save settings and test from EZDine")
    else:
        print("")
        print("❌ FAILED!")
        print("The printer test did not succeed. Check:")
        print("1. Printer IP address is correct")
        print("2. Printer is powered on and connected to network")
        print("3. Printer supports ESC/POS commands")
        print("4. No firewall blocking port 9100")
        print("5. Printer is not in use by another application")

if __name__ == "__main__":
    main()
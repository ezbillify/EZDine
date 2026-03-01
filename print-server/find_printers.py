#!/usr/bin/env python3
"""
Find thermal printers on local network
Scans common IP ranges for devices listening on port 9100
"""

import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor

def test_printer_port(ip, port=9100, timeout=2):
    """Test if a device responds on printer port"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((ip, port))
        sock.close()
        return result == 0
    except:
        return False

def scan_network_range(base_ip, start=1, end=254):
    """Scan IP range for printers"""
    print(f"🔍 Scanning {base_ip}.{start}-{end} for thermal printers...")
    print("This may take a minute...")
    
    found_printers = []
    
    def check_ip(i):
        ip = f"{base_ip}.{i}"
        if test_printer_port(ip):
            print(f"✅ Found printer at: {ip}:9100")
            found_printers.append(ip)
            return ip
        return None
    
    # Use threading for faster scanning
    with ThreadPoolExecutor(max_workers=50) as executor:
        futures = [executor.submit(check_ip, i) for i in range(start, end + 1)]
        
        # Show progress
        for i, future in enumerate(futures):
            if i % 50 == 0:
                print(f"📡 Scanned {i + start} IPs...")
            future.result()
    
    return found_printers

def main():
    print("🖨️ EZDine Printer Scanner")
    print("=" * 30)
    
    # Get local IP to determine network range
    try:
        # Connect to a remote address to get local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        
        print(f"Your computer IP: {local_ip}")
        
        # Extract network base (e.g., 192.168.1.x -> 192.168.1)
        base_ip = '.'.join(local_ip.split('.')[:-1])
        print(f"Scanning network: {base_ip}.1-254")
        print()
        
    except:
        print("Could not determine local IP, using default ranges")
        base_ip = "192.168.1"
    
    # Scan for printers
    printers = scan_network_range(base_ip)
    
    print("\n" + "=" * 30)
    if printers:
        print(f"🎉 Found {len(printers)} thermal printer(s):")
        for printer in printers:
            print(f"   📍 {printer}")
        
        print("\n📋 Next steps:")
        print("1. Test each printer:")
        for printer in printers:
            print(f"   python3 test_ip_printer.py {printer}")
        
        print("\n2. Use working IP in EZDine settings:")
        print("   - Go to Settings > Printing Setup")
        print("   - Connection Method: IP Address")
        print(f"   - IP Address: {printers[0]} (or test others)")
        
    else:
        print("❌ No thermal printers found on your network")
        print("\n🔍 Troubleshooting:")
        print("1. Check printer is powered on")
        print("2. Verify printer is connected to same WiFi/network")
        print("3. Print network configuration from printer")
        print("4. Check router admin panel for connected devices")
        print("5. Try different network ranges if you have multiple networks")

if __name__ == "__main__":
    main()
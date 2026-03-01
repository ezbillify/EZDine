#!/usr/bin/env python3
"""
Direct IP Printer Module for EZDine
Sends ESC/POS commands directly to thermal printers via IP address
"""

import socket
import time
from typing import List, Dict, Any

class ESCPOSCommands:
    """ESC/POS command constants for thermal printers"""
    
    # Basic commands
    ESC = b'\x1b'
    GS = b'\x1d'
    
    # Initialize printer
    INIT = ESC + b'@'
    
    # Text formatting
    BOLD_ON = ESC + b'E\x01'
    BOLD_OFF = ESC + b'E\x00'
    
    # Alignment
    ALIGN_LEFT = ESC + b'a\x00'
    ALIGN_CENTER = ESC + b'a\x01'
    ALIGN_RIGHT = ESC + b'a\x02'
    
    # Line feed
    LF = b'\n'
    
    # Cut paper
    CUT_FULL = GS + b'V\x00'
    CUT_PARTIAL = GS + b'V\x01'
    
    # Character size
    NORMAL_SIZE = GS + b'!\x00'
    DOUBLE_HEIGHT = GS + b'!\x10'
    DOUBLE_WIDTH = GS + b'!\x20'
    DOUBLE_SIZE = GS + b'!\x30'

class IPPrinter:
    """Direct IP printer communication"""
    
    def __init__(self, ip_address: str, port: int = 9100, timeout: int = 10):
        self.ip_address = ip_address
        self.port = port
        self.timeout = timeout
    
    def send_raw_data(self, data: bytes) -> bool:
        """Send raw bytes to printer via TCP socket"""
        try:
            print(f"🔌 Connecting to printer at {self.ip_address}:{self.port}")
            
            # Create socket connection
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)
            
            # Connect to printer
            sock.connect((self.ip_address, self.port))
            print(f"✅ Connected to printer")
            
            # Send data
            sock.sendall(data)
            print(f"📤 Sent {len(data)} bytes to printer")
            
            # Close connection
            sock.close()
            print(f"🔌 Connection closed")
            
            return True
            
        except socket.timeout:
            print(f"❌ Timeout connecting to printer at {self.ip_address}:{self.port}")
            return False
        except socket.gaierror as e:
            print(f"❌ DNS/Address error: {e}")
            return False
        except ConnectionRefusedError:
            print(f"❌ Connection refused by printer at {self.ip_address}:{self.port}")
            return False
        except Exception as e:
            print(f"❌ Printer communication error: {e}")
            return False
    
    def print_lines(self, lines: List[Dict[str, Any]], paper_width: int = 80) -> bool:
        """Convert print lines to ESC/POS and send to printer"""
        try:
            # Build ESC/POS command sequence
            commands = bytearray()
            
            # Initialize printer
            commands.extend(ESCPOSCommands.INIT)
            
            # Process each line
            for line in lines:
                text = line.get('text', '')
                align = line.get('align', 'left')
                bold = line.get('bold', False)
                
                # Set alignment
                if align == 'center':
                    commands.extend(ESCPOSCommands.ALIGN_CENTER)
                elif align == 'right':
                    commands.extend(ESCPOSCommands.ALIGN_RIGHT)
                else:
                    commands.extend(ESCPOSCommands.ALIGN_LEFT)
                
                # Set bold
                if bold:
                    commands.extend(ESCPOSCommands.BOLD_ON)
                
                # Add text (encode to bytes)
                commands.extend(text.encode('utf-8', errors='ignore'))
                
                # Turn off bold
                if bold:
                    commands.extend(ESCPOSCommands.BOLD_OFF)
                
                # Add line feed
                commands.extend(ESCPOSCommands.LF)
            
            # Add extra line feeds and cut
            commands.extend(ESCPOSCommands.LF * 3)
            commands.extend(ESCPOSCommands.CUT_PARTIAL)
            
            # Send to printer
            return self.send_raw_data(bytes(commands))
            
        except Exception as e:
            print(f"❌ Error building print commands: {e}")
            return False
    
    def test_connection(self) -> bool:
        """Test if printer is reachable"""
        try:
            print(f"🧪 Testing connection to {self.ip_address}:{self.port}")
            
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)  # Short timeout for test
            
            result = sock.connect_ex((self.ip_address, self.port))
            sock.close()
            
            if result == 0:
                print(f"✅ Printer is reachable at {self.ip_address}:{self.port}")
                return True
            else:
                print(f"❌ Cannot reach printer at {self.ip_address}:{self.port}")
                return False
                
        except Exception as e:
            print(f"❌ Connection test failed: {e}")
            return False

def print_to_ip_printer(ip_address: str, lines: List[Dict[str, Any]], paper_width: int = 80) -> bool:
    """
    Main function to print directly to IP printer
    
    Args:
        ip_address: IP address of the thermal printer
        lines: List of print lines with text, align, bold properties
        paper_width: Paper width in mm (58 or 80)
    
    Returns:
        bool: True if print successful, False otherwise
    """
    
    print(f"\n🖨️ === DIRECT IP PRINTING ===")
    print(f"🎯 Target: {ip_address}")
    print(f"📏 Paper: {paper_width}mm")
    print(f"📄 Lines: {len(lines)}")
    print(f"========================")
    
    # Create printer instance
    printer = IPPrinter(ip_address)
    
    # Test connection first
    if not printer.test_connection():
        print(f"❌ Cannot connect to printer - check IP address and network")
        return False
    
    # Print the job
    success = printer.print_lines(lines, paper_width)
    
    if success:
        print(f"✅ Print job sent successfully to {ip_address}")
    else:
        print(f"❌ Failed to send print job to {ip_address}")
    
    print(f"========================\n")
    return success

# Test function
def test_ip_printer(ip_address: str):
    """Test function to verify IP printer connectivity"""
    
    test_lines = [
        {"text": "=== PRINTER TEST ===", "align": "center", "bold": True},
        {"text": "EZDine POS System", "align": "center"},
        {"text": "IP Address Test", "align": "center"},
        {"text": f"Printer: {ip_address}", "align": "center"},
        {"text": f"Time: {time.strftime('%Y-%m-%d %H:%M:%S')}", "align": "center"},
        {"text": "==================", "align": "center"},
        {"text": "If you can read this,", "align": "left"},
        {"text": "IP printing is working!", "align": "left"},
        {"text": "==================", "align": "center"}
    ]
    
    return print_to_ip_printer(ip_address, test_lines)

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python3 ip_printer.py <printer_ip_address>")
        print("Example: python3 ip_printer.py 192.168.1.100")
        sys.exit(1)
    
    printer_ip = sys.argv[1]
    print(f"Testing IP printer at: {printer_ip}")
    
    success = test_ip_printer(printer_ip)
    if success:
        print("✅ IP printer test completed successfully!")
    else:
        print("❌ IP printer test failed!")
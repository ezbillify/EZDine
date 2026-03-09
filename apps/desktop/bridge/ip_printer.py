#!/usr/bin/env python3
"""
Direct IP Printer Module for EZDine Print Bridge
Sends ESC/POS commands directly to thermal printers via IP address
"""

import socket
import time
from typing import List, Dict, Any

class ESCPOSCommands:
    """ESC/POS command constants"""
    ESC = b'\x1b'
    GS = b'\x1d'
    INIT = ESC + b'@'
    BOLD_ON = ESC + b'E\x01'
    BOLD_OFF = ESC + b'E\x00'
    ALIGN_LEFT = ESC + b'a\x00'
    ALIGN_CENTER = ESC + b'a\x01'
    ALIGN_RIGHT = ESC + b'a\x02'
    LF = b'\n'
    CUT_PARTIAL = GS + b'V\x01'

class IPPrinter:
    def __init__(self, ip_address: str, port: int = 9100, timeout: int = 10):
        self.ip_address = ip_address
        self.port = port
        self.timeout = timeout
    
    def send_raw_data(self, data: bytes) -> bool:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)
            sock.connect((self.ip_address, self.port))
            sock.sendall(data)
            sock.close()
            return True
        except:
            return False
    
    def print_lines(self, lines: List[Dict[str, Any]], paper_width: int = 80) -> bool:
        try:
            commands = bytearray()
            commands.extend(ESCPOSCommands.INIT)
            
            for line in lines:
                text = line.get('text', '')
                align = line.get('align', 'left')
                bold = line.get('bold', False)
                
                if align == 'center':
                    commands.extend(ESCPOSCommands.ALIGN_CENTER)
                elif align == 'right':
                    commands.extend(ESCPOSCommands.ALIGN_RIGHT)
                else:
                    commands.extend(ESCPOSCommands.ALIGN_LEFT)
                
                if bold:
                    commands.extend(ESCPOSCommands.BOLD_ON)
                
                commands.extend(text.encode('utf-8', errors='ignore'))
                
                if bold:
                    commands.extend(ESCPOSCommands.BOLD_OFF)
                
                commands.extend(ESCPOSCommands.LF)
            
            commands.extend(ESCPOSCommands.LF * 3)
            commands.extend(ESCPOSCommands.CUT_PARTIAL)
            
            return self.send_raw_data(bytes(commands))
        except:
            return False
    
    def test_connection(self) -> bool:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            result = sock.connect_ex((self.ip_address, self.port))
            sock.close()
            return result == 0
        except:
            return False

def print_to_ip_printer(ip_address: str, lines: List[Dict[str, Any]], paper_width: int = 80) -> bool:
    printer = IPPrinter(ip_address)
    if not printer.test_connection():
        return False
    return printer.print_lines(lines, paper_width)

def test_ip_printer(ip_address: str):
    test_lines = [
        {"text": "=== PRINTER TEST ===", "align": "center", "bold": True},
        {"text": "EZDine Print Bridge", "align": "center"},
        {"text": f"IP: {ip_address}", "align": "center"},
        {"text": f"Time: {time.strftime('%Y-%m-%d %H:%M:%S')}", "align": "center"},
        {"text": "==================", "align": "center"}
    ]
    return print_to_ip_printer(ip_address, test_lines)
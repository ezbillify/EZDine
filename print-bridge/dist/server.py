#!/usr/bin/env python3
"""
EZDine Print Bridge - Production Version
Simple HTTP server that receives print jobs from EZDine web app
Supports both console logging and direct IP printer communication
"""

import json
import datetime
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import sys
import os

# Import IP printer module
try:
    from ip_printer import print_to_ip_printer, test_ip_printer
    IP_PRINTING_AVAILABLE = True
except ImportError:
    IP_PRINTING_AVAILABLE = False

# Store print jobs for debugging
print_jobs = []

class PrintServerHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        """Set CORS headers to allow requests from web app"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    
    def _send_json_response(self, status_code, data):
        """Send JSON response"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def do_OPTIONS(self):
        """Handle preflight CORS requests"""
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()
    
    def _is_ip_address(self, address):
        """Check if string is a valid IP address"""
        ip_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
        if re.match(ip_pattern, address):
            parts = address.split('.')
            return all(0 <= int(part) <= 255 for part in parts)
        return False
    
    def _handle_ip_printing(self, job):
        """Handle direct IP printing if printer ID is an IP address"""
        printer_id = job.get('printerId', '')
        
        if not self._is_ip_address(printer_id):
            return False, "Printer ID is not an IP address"
        
        if not IP_PRINTING_AVAILABLE:
            return False, "IP printing module not available"
        
        try:
            lines = job.get('lines', [])
            paper_width = job.get('width', 80)
            
            print(f"\n🎯 DIRECT IP PRINTING TO: {printer_id}")
            success = print_to_ip_printer(printer_id, lines, paper_width)
            
            if success:
                return True, f"Successfully printed to IP printer {printer_id}"
            else:
                return False, f"Failed to print to IP printer {printer_id}"
                
        except Exception as e:
            return False, f"IP printing error: {str(e)}"
    
    def do_GET(self):
        """Handle GET requests"""
        path = urlparse(self.path).path
        
        if path == '/health':
            self._send_json_response(200, {
                'status': 'ok',
                'message': 'EZDine Print Bridge is running',
                'timestamp': datetime.datetime.now().isoformat(),
                'totalJobs': len(print_jobs),
                'version': '1.0.0'
            })
        
        elif path == '/jobs':
            self._send_json_response(200, {
                'jobs': print_jobs[-10:],
                'total': len(print_jobs)
            })
        
        elif path.startswith('/test-ip/'):
            ip_address = path.split('/test-ip/')[-1]
            
            if not self._is_ip_address(ip_address):
                self._send_json_response(400, {
                    'success': False,
                    'error': 'Invalid IP address format'
                })
                return
            
            if not IP_PRINTING_AVAILABLE:
                self._send_json_response(500, {
                    'success': False,
                    'error': 'IP printing module not available'
                })
                return
            
            try:
                print(f"\n🧪 Testing IP printer: {ip_address}")
                success = test_ip_printer(ip_address)
                
                self._send_json_response(200, {
                    'success': success,
                    'message': f'IP printer test {"successful" if success else "failed"}',
                    'ip_address': ip_address,
                    'timestamp': datetime.datetime.now().isoformat()
                })
            except Exception as e:
                self._send_json_response(500, {
                    'success': False,
                    'error': f'IP printer test failed: {str(e)}'
                })
        
        else:
            self._send_json_response(404, {
                'success': False,
                'error': 'Endpoint not found',
                'availableEndpoints': [
                    'GET /health - Check server status',
                    'POST /print - Send print job',
                    'GET /jobs - View recent print jobs',
                    'DELETE /jobs - Clear print job history',
                    'GET /test-ip/{ip_address} - Test IP printer connection'
                ]
            })
    
    def do_POST(self):
        """Handle POST requests"""
        path = urlparse(self.path).path
        
        if path == '/print':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                job = json.loads(post_data.decode('utf-8'))
                
                timestamp = datetime.datetime.now().isoformat()
                job_with_meta = {
                    **job,
                    'timestamp': timestamp,
                    'id': len(print_jobs) + 1
                }
                print_jobs.append(job_with_meta)
                
                self._print_job_to_console(job, len(print_jobs))
                
                ip_success, ip_message = self._handle_ip_printing(job)
                
                response_data = {
                    'success': True,
                    'message': 'Print job processed successfully',
                    'jobId': len(print_jobs),
                    'timestamp': timestamp,
                    'printer': job.get('printerId', 'unknown'),
                    'lines': len(job.get('lines', []))
                }
                
                if self._is_ip_address(job.get('printerId', '')):
                    response_data['ipPrinting'] = {
                        'attempted': True,
                        'success': ip_success,
                        'message': ip_message
                    }
                    
                    if ip_success:
                        print(f"✅ {ip_message}")
                    else:
                        print(f"❌ {ip_message}")
                        response_data['message'] += f" (IP printing failed: {ip_message})"
                
                self._send_json_response(200, response_data)
                
            except Exception as e:
                print(f"❌ Error processing print job: {e}")
                self._send_json_response(500, {
                    'success': False,
                    'error': 'Failed to process print job',
                    'message': str(e)
                })
        else:
            self._send_json_response(404, {
                'success': False,
                'error': 'Endpoint not found'
            })
    
    def do_DELETE(self):
        """Handle DELETE requests"""
        path = urlparse(self.path).path
        
        if path == '/jobs':
            count = len(print_jobs)
            print_jobs.clear()
            print(f"🗑️ Cleared {count} print jobs")
            self._send_json_response(200, {
                'message': f'Cleared {count} print jobs'
            })
        else:
            self._send_json_response(404, {
                'success': False,
                'error': 'Endpoint not found'
            })
    
    def _print_job_to_console(self, job, job_number):
        """Print job details to console"""
        print('\n🖨️ ' + '=' * 32)
        print('📄 PRINT JOB RECEIVED')
        print('🕐 Time:', datetime.datetime.now().strftime('%m/%d/%Y, %I:%M:%S %p'))
        print('🖨️ Printer ID:', job.get('printerId', 'unknown'))
        print('📏 Paper Width:', str(job.get('width', 'unknown')) + 'mm')
        print('📋 Print Type:', job.get('type', 'unknown').upper())
        print('🔢 Job #:', job_number)
        print('=' * 32)
        
        lines = job.get('lines', [])
        if lines:
            print('📝 CONTENT:')
            for line in lines:
                text = line.get('text', '')
                align = line.get('align', 'left')
                bold = line.get('bold', False)
                
                if align == 'center':
                    prefix = '    '
                elif align == 'right':
                    prefix = '        '
                else:
                    prefix = ''
                
                weight = ' (BOLD)' if bold else ''
                print(f"{prefix}{text}{weight}")
        
        print('=' * 32)
        print('✅ Print job processed successfully')
        print('🔄 Total jobs processed:', job_number)
        print('=' * 32 + '\n')
    
    def log_message(self, format, *args):
        """Override to reduce server logging noise"""
        pass

def run_server(port=8080):
    """Start the print server"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, PrintServerHandler)
    
    print('\n🚀 ' + '=' * 40)
    print('🖨️  EZDINE PRINT BRIDGE STARTED')
    print('=' * 40)
    print('🌐 Server URL:', f'http://localhost:{port}')
    print('💚 Health Check:', f'http://localhost:{port}/health')
    print('📋 View Jobs:', f'http://localhost:{port}/jobs')
    print('🔧 Ready to receive print jobs from EZDine')
    print('=' * 40 + '\n')
    
    print('✅ Print Bridge is running')
    print('🛑 Press Ctrl+C to stop\n')
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n\n🛑 Print Bridge stopped')
        httpd.server_close()

if __name__ == '__main__':
    port = 8080
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print('Invalid port number, using default 8080')
    
    run_server(port)
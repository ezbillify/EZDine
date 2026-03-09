const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const net = require('net');
const os = require('os');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = 4000;

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (i.e. 127.0.0.1) and non-ipv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

app.get('/', (req, res) => {
  const ips = getLocalIPs();
  const ipList = ips.map(ip => `<li><strong>${ip}</strong></li>`).join('');

  res.send(`
    <html>
      <body style="font-family: sans-serif; padding: 2rem; text-align: center;">
        <div style="border: 2px solid #000; padding: 20px; display: inline-block; border-radius: 10px;">
          <h1>🖨️ EZDine Print Bridge</h1>
          <p style="color: green; font-weight: bold;">● Service Active on Port ${PORT}</p>
          <hr/>
          <h3>Your IP Address:</h3>
          <ul style="list-style: none; padding: 0; font-size: 1.5rem;">
            ${ipList}
          </ul>
          <p style="color: grey; font-size: 0.9rem;">(Enter this IP in your EZDine App Settings)</p>
        </div>
      </body>
    </html>
  `);
});

app.post('/print', (req, res) => {
  const { printerId, lines, font } = req.body;
  console.log(`Print Job Received for: ${printerId} using font: ${font || 'default'}`);

  let targetHost = printerId || '127.0.0.1';

  // If it's a logical name (no dots), default to 127.0.0.1 for local USB bridge
  // Unless it's 'usb' or 'localhost' specifically.
  if (targetHost.indexOf('.') === -1 && targetHost !== 'localhost') {
    console.log(`Logical Printer Name Detected: ${targetHost}. Mapping to local bridge listener.`);
    targetHost = '127.0.0.1';
  }

  const client = new net.Socket();
  const PRINTER_PORT = 9100;

  // Build the buffer
  let buffer = Buffer.from([0x1B, 0x40]); // Init
  if (font === 'font-b') {
    buffer = Buffer.concat([buffer, Buffer.from([0x1B, 0x4D, 1])]);
  } else {
    buffer = Buffer.concat([buffer, Buffer.from([0x1B, 0x4D, 0])]);
  }

  lines.forEach(line => {
    let mode = 0;
    if (line.bold) mode += 8;
    buffer = Buffer.concat([buffer, Buffer.from([0x1B, 0x21, mode])]);

    let align = 0;
    if (line.align === 'center') align = 1;
    if (line.align === 'right') align = 2;
    buffer = Buffer.concat([buffer, Buffer.from([0x1B, 0x61, align])]);

    buffer = Buffer.concat([buffer, Buffer.from(line.text + '\n')]);
  });

  buffer = Buffer.concat([buffer, Buffer.from([0x1D, 0x56, 66, 0])]); // Cut

  // DECISION: TCP (Network) vs Spooler (USB)
  const isLogicalName = printerId && printerId.indexOf('.') === -1 && printerId !== 'localhost';

  if (isLogicalName && os.platform() === 'win32') {
    // WINDOWS USB SUPPORT: Use 'copy /b' to shared printer
    const fs = require('fs');
    const path = require('path');
    const { exec } = require('child_process');
    const tempFile = path.join(os.tmpdir(), `print_${Date.now()}.bin`);

    fs.writeFileSync(tempFile, buffer);

    const printerPath = `\\\\localhost\\${printerId}`;
    console.log(`Windows USB Print: Sending raw bytes to ${printerPath}`);

    exec(`copy /b "${tempFile}" "${printerPath}"`, (error, stdout, stderr) => {
      try { fs.unlinkSync(tempFile); } catch (e) { }
      if (error) {
        console.error("USB Print Error:", stderr);
        return res.status(500).json({ error: "USB Print Failed: " + stderr });
      }
      res.json({ success: true });
    });
  } else if (isLogicalName && os.platform() === 'darwin') {
    // MAC USB SUPPORT: Use 'lp'
    const fs = require('fs');
    const path = require('path');
    const { exec } = require('child_process');
    const tempFile = path.join(os.tmpdir(), `print_${Date.now()}.bin`);

    fs.writeFileSync(tempFile, buffer);
    console.log(`Mac USB Print: Sending raw bytes to ${printerId}`);

    exec(`lp -d "${printerId}" "${tempFile}"`, (error, stdout, stderr) => {
      try { fs.unlinkSync(tempFile); } catch (e) { }
      if (error) {
        console.error("USB Print Error:", stderr);
        return res.status(500).json({ error: "USB Print Failed: " + stderr });
      }
      res.json({ success: true });
    });
  } else {
    // DEFAULT: TCP Socket (Network Printer)
    console.log(`Attempting TCP Connection to ${targetHost}:${PRINTER_PORT}...`);
    client.connect(PRINTER_PORT, targetHost, () => {
      console.log(`Connected to Network Printer at ${targetHost}`);
      client.write(buffer);
      client.end();
      res.json({ success: true });
    });

    client.on('error', (err) => {
      console.error(`Printer Connection Failed (${targetHost}):`, err.message);
      res.status(500).json({ error: "Printer Connection Failed: " + err.message });
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log(`
  ▒█▀▀▀ ▒█▀▀▀█ ▒█▀▀▄ ▒█▀▀▀█ ▒█▄░▒█ ▒█▀▀▀
  ▒█▀▀▀ ░▄▄▄▀▀ ▒█░▒█ ░▀▀▀▄▄ ▒█▒█▒█ ▒█▀▀▀
  ▒█▄▄▄ ▒█▄▄▄█ ▒█▄▄▀ ▒█▄▄▄█ ▒█░░▀█ ▒█▄▄▄
  
  ✅ PRINT BRIDGE ACTIVE on Port ${PORT}
  ------------------------------------
  YOUR IP ADDRESS: ${ips.join(', ')}
  ------------------------------------
  1. Open EZDine App on your Tablet/Phone
  2. Go to Settings > Printer Setup
  3. Enter IP: ${ips[0]}
  `);
});

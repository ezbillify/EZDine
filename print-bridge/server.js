const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const net = require('net');
const os = require('os');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || process.argv[2] || 4000;

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
      <head>
        <title>EZDine Print Bridge</title>
        <style>
          body { font-family: sans-serif; padding: 2rem; text-align: center; background: #f8fafc; color: #1e293b; }
          .card { border: 1px solid #e2e8f0; padding: 30px; display: inline-block; border-radius: 20px; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 500px; width: 100%; }
          .status { color: #059669; font-weight: bold; background: #ecfdf5; padding: 4px 12px; border-radius: 20px; display: inline-block; margin-bottom: 20px; }
          h1 { margin: 0; color: #0f172a; }
          ul { list-style: none; padding: 0; font-size: 1.2rem; }
          .ip-box { background: #f1f5f9; padding: 15px; border-radius: 12px; margin: 15px 0; }
          .printer-list { text-align: left; margin-top: 20px; padding: 15px; background: #fff7ed; border-radius: 12px; border: 1px solid #ffedd5; }
          .printer-list h3 { margin-top: 0; color: #9a3412; font-size: 0.9rem; text-transform: uppercase; }
          .printer-name { font-family: monospace; font-size: 0.9rem; background: #ffdead; padding: 2px 6px; border-radius: 4px; display: inline-block; margin: 2px; }
          code { background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="status">● Service Active on Port ${PORT}</div>
          <h1>🖨️ EZDine Print Bridge</h1>
          <p>Local Printing Hub for EZBillify POS</p>
          
          <div class="ip-box">
            <p style="margin-top: 0; font-weight: bold; color: #64748b;">BRIDGE URL:</p>
            <code>http://${ips[0] || 'localhost'}:${PORT}</code>
          </div>

          <div id="printers" class="printer-list">
            <h3>Detected Local Printers:</h3>
            <div id="list-content">Loading printers...</div>
          </div>

          <p style="color: grey; font-size: 0.8rem; margin-top: 20px;">
            Copy the <strong>BRIDGE URL</strong> into your EZDine Web POS Settings.<br/>
            Then type the <strong>Printer Name</strong> exactly as shown above.
          </p>
        </div>

        <script>
          fetch('/printers')
            .then(res => res.json())
            .then(data => {
              const list = data.map(p => \`<span class="printer-name">\${p}</span>\`).join('');
              document.getElementById('list-content').innerHTML = list || 'No printers detected';
            })
            .catch(() => {
              document.getElementById('list-content').innerHTML = 'Error loading printers';
            });
        </script>
      </body>
    </html>
  `);
});

app.get('/health', (req, res) => res.send('OK'));

app.get('/printers', (req, res) => {
  const { exec } = require('child_process');
  if (os.platform() === 'win32') {
    // Windows: Use WMIC to get printer names
    exec('wmic printer get name', (error, stdout) => {
      if (error) return res.json([]);
      const printers = stdout.split('\\r\\n')
        .map(p => p.trim())
        .filter(p => p && p !== 'Name');
      res.json(printers);
    });
  } else if (os.platform() === 'darwin') {
    // Mac: Use lpstat -v
    exec('lpstat -v', (error, stdout) => {
      if (error) return res.json([]);
      const printers = stdout.split('\\n')
        .map(line => {
          const match = line.match(/device for (.*?):/);
          return match ? match[1] : null;
        })
        .filter(Boolean);
      res.json(printers);
    });
  } else {
    res.json([]);
  }
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
  let cleanPrinterId = printerId.replace(/^\\\\+/, '').replace(/^[A-Z]:/, ''); // Remove slashes/drive letters
  const isLogicalName = cleanPrinterId && cleanPrinterId.indexOf('.') === -1 && cleanPrinterId !== 'localhost';

  if (isLogicalName && os.platform() === 'win32') {
    // WINDOWS USB SUPPORT: Use 'copy /b' to shared printer
    const fs = require('fs');
    const path = require('path');
    const { exec } = require('child_process');
    const tempFile = path.join(os.tmpdir(), `print_${Date.now()}.bin`);

    fs.writeFileSync(tempFile, buffer);

    // We will try several common printer paths
    const pathsToTry = [
      `\\\\127.0.0.1\\${cleanPrinterId}`,
      `\\\\localhost\\${cleanPrinterId}`,
      `\\\\${os.hostname()}\\${cleanPrinterId}`
    ];

    let triedCount = 0;
    const tryPrint = (idx) => {
      if (idx >= pathsToTry.length) {
        return res.status(500).json({ error: "USB Print Failed after trying all local paths. Please ensure printer is shared correctly." });
      }

      const p = pathsToTry[idx];
      console.log(`[Windows USB] Attempt ${idx + 1}: Sending to ${p}`);

      exec(`copy /b "${tempFile}" "${p}"`, (error, stdout, stderr) => {
        if (!error) {
          console.log(`[Success] Printed to ${p}`);
          try { fs.unlinkSync(tempFile); } catch (e) { }
          return res.json({ success: true });
        } else {
          console.warn(`[Fail] Path ${p} failed. Trying next...`);
          tryPrint(idx + 1);
        }
      });
    };

    tryPrint(0);
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

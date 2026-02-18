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
    const { printerId, lines } = req.body;
    console.log(`Print Job Received for: ${printerId}`);

    let targetHost = printerId;
    if (!targetHost || targetHost.indexOf('.') === -1) {
        if (targetHost === 'usb' || targetHost === 'localhost') {
            targetHost = '127.0.0.1';
        } else {
            console.log("Invalid IP, defaulting to localhost simulation.");
            targetHost = '127.0.0.1';
        }
    }

    const client = new net.Socket();
    const PRINTER_PORT = 9100;

    client.connect(PRINTER_PORT, targetHost, () => {
        console.log(`Connected to Printer at ${targetHost}:${PRINTER_PORT}`);
        client.write(Buffer.from([0x1B, 0x40])); // Init

        lines.forEach(line => {
            let mode = 0;
            if (line.bold) mode += 8;
            client.write(Buffer.from([0x1B, 0x21, mode]));

            let align = 0;
            if (line.align === 'center') align = 1;
            if (line.align === 'right') align = 2;
            client.write(Buffer.from([0x1B, 0x61, align]));

            client.write(line.text + '\n');
        });

        client.write(Buffer.from([0x1D, 0x56, 66, 0])); // Cut
        client.end();
        res.json({ success: true });
    });

    client.on('error', (err) => {
        console.error(`Printer Connection Failed (${targetHost}):`, err.message);
        res.status(500).json({ error: "Printer Connection Failed: " + err.message });
    });
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

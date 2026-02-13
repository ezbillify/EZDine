const fs = require("fs");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const {
  ThermalPrinter,
  PrinterTypes,
  CharacterSet,
  BreakLine
} = require("node-thermal-printer");

const configPath = path.join(__dirname, "config.json");
if (!fs.existsSync(configPath)) {
  console.error("Missing config.json. Copy config.example.json to config.json.");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));

function getPrinterById(printerId) {
  return (config.printers || []).find((p) => p.id === printerId);
}

function buildPrinter(printerConfig) {
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: printerConfig.interface,
    characterSet: CharacterSet.PC437_USA,
    removeSpecialCharacters: false,
    lineCharacter: "-"
  });
  return printer;
}

app.post("/print", async (req, res) => {
  try {
    const { printerId, lines } = req.body;
    if (!printerId || !Array.isArray(lines)) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const printerConfig = getPrinterById(printerId);
    if (!printerConfig) {
      return res.status(404).json({ error: "Printer not found" });
    }

    const printer = buildPrinter(printerConfig);

    for (const line of lines) {
      if (line.bold) printer.bold(true);
      if (line.align === "center") printer.alignCenter();
      else if (line.align === "right") printer.alignRight();
      else printer.alignLeft();
      printer.println(line.text || "");
      if (line.bold) printer.bold(false);
    }

    printer.cut();
    printer.println(BreakLine);

    const success = await printer.execute();
    if (!success) {
      return res.status(500).json({ error: "Printer error" });
    }

    res.json({ status: "ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(config.port || 4001, () => {
  console.log(`Print server running on :${config.port || 4001}`);
});

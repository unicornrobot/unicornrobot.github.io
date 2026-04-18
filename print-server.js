// Thermal printer server for EM5820 (GD Microelectronics 28e9:0289)
// Run: node print-server.js
// Requires: npm install express escpos escpos-usb

const express = require('express');
const escpos  = require('escpos');
escpos.USB    = require('escpos-usb').USB;

const VENDOR  = 0x28e9;
const PRODUCT = 0x0289;
const PORT    = 3001;

const app = express();
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
app.options('*', (req, res) => res.sendStatus(204));

app.post('/print', (req, res) => {
    const { lines = [], cut = true } = req.body;
    let device;
    try {
        device = new escpos.USB(VENDOR, PRODUCT);
    } catch(e) {
        console.error('Printer not found:', e.message);
        return res.status(503).json({ error: 'Printer not found' });
    }
    const printer = new escpos.Printer(device, { encoding: 'UTF8' });
    device.open((err) => {
        if (err) {
            console.error('Open failed:', err.message);
            return res.status(503).json({ error: err.message });
        }
        try {
            printer.align('CT');
            lines.forEach((line, i) => {
                if (i === 0) {
                    // Title — bold + larger
                    printer.style('B').size(1, 1).text(line).style('NORMAL').size(0, 0);
                } else {
                    printer.text(line);
                }
            });
            printer.feed(3);
            if (cut) printer.cut();
            printer.close();
            res.json({ ok: true });
        } catch(e) {
            console.error('Print error:', e.message);
            res.status(500).json({ error: e.message });
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Print server listening on http://127.0.0.1:${PORT}`);
    console.log(`Targeting printer ${VENDOR.toString(16)}:${PRODUCT.toString(16)}`);
});

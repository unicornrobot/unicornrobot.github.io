// Thermal printer server for EM5820 — writes raw ESC/POS to /dev/usb/lp0
// Run: node print-server.js
// Requires: npm install express

const express = require('express');
const fs      = require('fs');

const PRINTER = '/dev/usb/lp0';
const PORT    = 3001;

// ESC/POS command bytes
const ESC = 0x1b;
const GS  = 0x1d;
const CMD = {
    reset:      Buffer.from([ESC, 0x40]),
    alignCtr:   Buffer.from([ESC, 0x61, 0x01]),
    bold:       Buffer.from([ESC, 0x45, 0x01]),
    boldOff:    Buffer.from([ESC, 0x45, 0x00]),
    dblSize:    Buffer.from([GS,  0x21, 0x11]),  // 2x width + 2x height
    normalSize: Buffer.from([GS,  0x21, 0x00]),
    feed3:      Buffer.from([ESC, 0x64, 0x03]),
    cut:        Buffer.from([GS,  0x56, 0x41, 0x03]),
    newline:    Buffer.from([0x0a]),
};

function buildPrintBuffer(lines, cut) {
    const parts = [CMD.reset, CMD.alignCtr];
    lines.forEach((line, i) => {
        if (i === 0) {
            parts.push(CMD.bold, CMD.dblSize);
            parts.push(Buffer.from(line + '\n', 'utf8'));
            parts.push(CMD.boldOff, CMD.normalSize);
        } else {
            parts.push(Buffer.from(line + '\n', 'utf8'));
        }
    });
    parts.push(CMD.feed3);
    if (cut) parts.push(CMD.cut);
    return Buffer.concat(parts);
}

const app = express();
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
app.options('/{*path}', (req, res) => res.sendStatus(204));

app.get('/', (req, res) => res.json({ status: 'Print server online', device: PRINTER }));

app.post('/print', (req, res) => {
    const { lines = [], cut = true } = req.body;
    const buf = buildPrintBuffer(lines, cut);
    fs.open(PRINTER, 'w', (err, fd) => {
        if (err) {
            console.error('Open failed:', err.message);
            return res.status(503).json({ error: err.message });
        }
        fs.write(fd, buf, (err2) => {
            fs.close(fd, () => {});
            if (err2) {
                console.error('Write failed:', err2.message);
                return res.status(500).json({ error: err2.message });
            }
            console.log(`Printed ${lines.length} lines`);
            res.json({ ok: true });
        });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Print server listening on port ${PORT}`);
    console.log(`Writing to ${PRINTER}`);
});

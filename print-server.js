// Thermal printer server — receives a PNG image from the client and prints
// it via the TiMini-Print CLI binary.
//
// Run: node print-server.js
// Requires: npm install express
//
// The TiMini-Print binary path can be overridden with the TIMINI_BIN env var.
// Default expects the binary to be in the same directory as this server.

const express = require('express');
const fs      = require('fs');
const os      = require('os');
const path    = require('path');
const { spawn } = require('child_process');

const PORT       = 3001;
const TIMINI_BIN = process.env.TIMINI_BIN
    || path.join(__dirname, 'TiMini-Print-Command-Line-Linux-arm64');

const app = express();
app.use(express.json({ limit: '20mb' }));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
app.options('/{*path}', (req, res) => res.sendStatus(204));

app.get('/', (req, res) => res.json({
    status: 'Print server online',
    bin: TIMINI_BIN,
}));

app.post('/print', (req, res) => {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

    const tmpPath = path.join(os.tmpdir(), `print-${Date.now()}-${process.pid}.png`);
    const buf = Buffer.from(imageBase64.replace(/^data:.*?;base64,/, ''), 'base64');

    fs.writeFile(tmpPath, buf, (err) => {
        if (err) {
            console.error('Write temp failed:', err.message);
            return res.status(500).json({ error: err.message });
        }
        const proc = spawn(TIMINI_BIN, [tmpPath]);
        let stderr = '';
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('error', e => {
            fs.unlink(tmpPath, () => {});
            console.error('Spawn failed:', e.message);
            res.status(500).json({ error: e.message });
        });
        proc.on('close', code => {
            fs.unlink(tmpPath, () => {});
            if (code === 0) {
                console.log(`Printed image (${buf.length} bytes)`);
                res.json({ ok: true });
            } else {
                console.error(`TiMini-Print exit ${code}: ${stderr.trim()}`);
                res.status(500).json({ error: stderr.trim() || `exit ${code}` });
            }
        });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Print server listening on port ${PORT}`);
    console.log(`Using binary: ${TIMINI_BIN}`);
});

# Raspberry Pi Setup — Unicorn Robot Installation

This folder backs up and reproduces the Pi-side configuration for the kiosk + thermal printer.

| File | Purpose |
|------|---------|
| `restore.sh` | One-shot script that puts everything back on a fresh Pi OS install |
| `config/lxsession-autostart` | Chromium kiosk launcher (lives at `~/.config/lxsession/rpd-x/autostart` on the Pi) |
| `config/print-server.js` | Node thermal printer bridge (copy of the project root file, kept here for clarity) |
| `config/dump.pm2` | PM2 process list snapshot (`pm2 save`) |
| `config/crontab.txt` | Crontab dump (may be empty) |

## Hardware

- **Raspberry Pi 4** (Pi OS Trixie, x11 + LXDE session)
- **EM5820 thermal printer** — paired over **Bluetooth**, driven by the [TiMini-Print](https://github.com/Dejniel/TiMini-Print) CLI binary
- **ESP32** with 8 capacitive touch sensors / 3 rotary encoders / 2 buttons — connected by USB serial

## One-time manual setup (do these on a fresh Pi OS install before running `restore.sh`)

1. **Auto-login to desktop**
   `sudo raspi-config` → System Options → Boot / Auto Login → **Desktop Autologin**

2. **Disable screen blanking**
   `sudo raspi-config` → Display Options → Screen Blanking → **Off**

3. **Connect Wi-Fi** (panel applet or `nmtui`)

4. **Install dependencies**
   ```bash
   sudo apt update
   sudo apt install -y nodejs npm chromium git
   sudo npm install -g pm2
   ```

5. **Pair the EM5820 thermal printer over Bluetooth**
   ```bash
   bluetoothctl
   power on
   agent on
   default-agent
   scan on
   # wait for "Printer_xxxx" to appear, then
   pair  <MAC>
   trust <MAC>
   exit
   ```
   Test: `~/TiMini-Print-Command-Line-Linux-arm64 some-image.png` should print.

6. **Download the TiMini-Print binary**
   Grab the latest `TiMini-Print-Command-Line-Linux-arm64` from the [releases page](https://github.com/Dejniel/TiMini-Print/releases) and place it in `~/`. Make it executable:
   ```bash
   chmod +x ~/TiMini-Print-Command-Line-Linux-arm64
   ```

7. **Clone the repo**
   ```bash
   cd ~
   git clone https://github.com/unicornrobot/unicornrobot.github.io.git
   ```

8. **Run the restore script**
   ```bash
   cd ~/unicornrobot.github.io
   bash pi/restore.sh
   ```

9. **Reboot** — the kiosk should come up in fullscreen Chromium pointing at `https://unicornrobot.github.io`, and the print server should be live on `http://localhost:3001`.

## Verifying after a reboot

```bash
pm2 status                                    # print-server should be 'online'
curl http://localhost:3001/                   # should return JSON status
pgrep -af chromium                            # should show the kiosk process
```

If chromium doesn't appear: `cat ~/.cache/lxsession/rpd-x/run.log` for errors.
If the printer doesn't respond: confirm Bluetooth pairing with `bluetoothctl devices`.

## Updating the deployed code

The kiosk loads from `https://unicornrobot.github.io`, so a `git push` to `main` is the deploy.
The print server runs locally — to deploy server changes:

```bash
cd ~/unicornrobot.github.io
git pull
cp print-server.js ~/print-server.js          # if you keep the runtime copy at ~
pm2 restart print-server
```

## Files this repo does NOT back up (and why)

- **Wi-Fi credentials** — held in `/etc/NetworkManager/system-connections/*.nmconnection`. Reconnect manually after reimaging.
- **Bluetooth pairing keys** — held in `/var/lib/bluetooth/`. Re-pair after reimaging.
- **The TiMini-Print binary** — large and version-tied; download fresh from upstream.

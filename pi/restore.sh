# pi/restore.sh
#!/bin/bash
set -e
mkdir -p ~/.config/lxsession/rpd-x
cp pi/config/lxsession-autostart ~/.config/lxsession/rpd-x/autostart
chmod 644 ~/.config/lxsession/rpd-x/autostart

cp pi/print-server.js ~/print-server.js
cd ~ && npm install express

pm2 start ~/print-server.js --name print-server
pm2 save
pm2 startup    # follow the printed sudo command

echo "Done. Reboot to verify."


Run these on the Pi to test raw printing:


# Give yourself permission to the device
sudo chmod 666 /dev/bus/usb/001/010

# Or better — permanent udev rule using your exact vendor:product IDs
echo 'SUBSYSTEM=="usb", ATTRS{idVendor}=="28e9", ATTRS{idProduct}=="0289", MODE="0666"' | sudo tee /etc/udev/rules.d/99-thermal.rules
sudo udevadm control --reload-rules && sudo udevadm trigger

# Check if it also appears as a line printer device
ls /dev/usb/lp* /dev/lp* 2>/dev/null

# Raw test — if lp0 exists:
printf "Hello World\n\n\n" > /dev/usb/lp0

# ESC/POS test with cut — if lp0 exists:
printf "\x1b\x40Hello World\n\n\n\x1d\x56\x41\x03" > /dev/usb/lp0
If /dev/usb/lp0 doesn't exist, the usblp kernel module may not be loaded:


sudo modprobe usblp
ls /dev/usb/lp*
If it still doesn't appear, the escpos-usb Node package talks directly to the USB device via libusb (bypassing the lp device entirely), which needs:


sudo apt install libusb-1.0-0-dev
Then in your print server, new escpos.USB(0x28e9, 0x0289) will target it directly by vendor/product ID. Let me know what ls /dev/usb/lp* shows and whether the raw printf test prints anything.

bash: /dev/usb/lp0: Permission denied
You need to reload the udev rule properly — the chmod needs to be re-applied after the rule is in place:


# Unplug and replug the printer, then check permissions
ls -la /dev/usb/lp0

# If still root-owned, force the udev trigger
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=usb

# Then try again
printf "Hello World\n\n\n" > /dev/usb/lp0
If that still fails, the quickest workaround is just prefix with sudo:


printf "Hello World\n\n\n" | sudo tee /dev/usb/lp0
If that prints something, the hardware works and the only issue is permissions. Then fix permanently:


# Check what group owns the device
ls -la /dev/usb/lp0

# Add yourself to that group (usually 'lp')
sudo usermod -a -G lp $USER

# Log out and back in, then retry without sudo
printf "Hello World\n\n\n" > /dev/usb/lp0
What does ls -la /dev/usb/lp0 show?

crw-rw---- 1 root lp 180, 0 Apr 18 12:59 /dev/usb/lp0
You just need to add yourself to the lp group:


sudo usermod -a -G lp $USER
Then log out and back in (or newgrp lp to apply immediately without logout):


newgrp lp

# Now test
printf "Hello World\n\n\n" > /dev/usb/lp0

# ESC/POS test with paper cut
printf "\x1b\x40Hello World\n\n\n\x1d\x56\x41\x03" > /dev/usb/lp0
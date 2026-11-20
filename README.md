# Transfer Anywhere

Transfer files and text directly between devices on the **same Wi-Fi network or local network (LAN)**.

Transfer Anywhere uses **WebRTC DataChannels** for peer-to-peer transfers. The Node.js server creates six-digit sessions and helps devices establish a connection. File and text data are sent directly between connected browsers when the WebRTC connection succeeds.

## Features

- File Transfer and Text Transfer
- Send and receive using a six-digit code
- Multiple devices can join the same session
- Many-to-many communication: connected devices can send and receive
- Incoming file requests can be accepted or rejected
- File transfer progress
- No cloud storage or paid API required
- Designed for the same Wi-Fi/LAN

## Requirements

- Node.js **18 or newer**
- A computer to run the local server
- All participating devices connected to the same Wi-Fi/LAN
- The host computer's firewall must allow the app on the local network (TCP port `3000`)

## Download and Run

### 1. Download the Project

1. Open this GitHub repository.
2. Click the green **Code** button.
3. Select **Download ZIP**.
4. Extract the downloaded ZIP file to a folder on your computer.

You can also clone the repository with Git:

```bash
git clone YOUR_REPOSITORY_URL
cd transfer-anywhere
```

Replace `YOUR_REPOSITORY_URL` with the URL of this repository.

### 2. Install Node.js

If Node.js is not installed, download and install the LTS version from:

https://nodejs.org/

After installation, open Command Prompt or PowerShell and check:

```bash
node -v
npm -v
```

Make sure Node.js is version 18 or newer.

### 3. Install Dependencies

Open a terminal inside the extracted project folder (the folder containing `package.json`) and run:

```bash
npm install
```

This downloads the required packages. You only need to do this once, unless the project dependencies change.

### 4. Start the Server

Run:

```bash
npm start
```

Keep this terminal window open while using Transfer Anywhere.

On the host computer, open this address in a browser:

```text
http://localhost:3000
```

## Connect Other Devices on the Same Wi-Fi

### 1. Find the Host Computer's Local IP Address

On Windows:

1. Open Command Prompt.
2. Run:

```bash
ipconfig
```

3. Find the active Wi-Fi adapter and note its **IPv4 Address** (for example, `192.168.1.10`).

### 2. Open Transfer Anywhere on Another Device

Connect the phone, laptop, or other device to the same Wi-Fi network.

Open its browser and enter the host computer's address, using the IP you found:

```text
http://192.168.1.10:3000
```

Replace `192.168.1.10` with your host computer's actual IPv4 address.

If Windows Firewall asks for permission, allow Node.js on **Private networks**. Do not expose the server to public networks.

### 3. Send and Receive

1. On the sending device, open **Send File** or **Send Text**.
2. Select a file or enter text, then start sending to create a six-digit session code.
3. On another device, open the matching **Receive File** or **Receive Text** tab and enter that code.
4. Accept an incoming file request to receive the file.

Devices that join the same session can send and receive. Keep the host server and the relevant browser tabs open during transfers.

## Important Notes

- **Local Network Only:** This project is designed for devices on the same Wi-Fi/LAN. It is not a cloud-based file sharing service.
- **Host Must Stay Online:** The computer running `npm start` must remain on, and the server terminal must stay open.
- **Code Expiry:** A session code accepts new devices for 10 minutes after it is created.
- **WebRTC Connectivity:** The current MVP does not use a public STUN/TURN service (`iceServers: []`). Direct connection depends on browser and router behavior. Some Wi-Fi networks may block device-to-device communication (for example, AP/client isolation), which can prevent connections.
- **Many-to-Many Mesh:** Each pair of connected devices establishes its own peer connection. Sending one file to multiple receivers uses the sender's upload bandwidth for each receiver.
- **Large Files:** Maximum reliable file size has not been established. Browser memory and device resources can limit large transfers.
- **Security:** This is an MVP for trusted local networks, not a production-hardened service. Do not expose it to the public internet. Use it only with people and devices you trust.

## Troubleshooting

### Another Device Cannot Open the Website

- Confirm both devices are connected to the same Wi-Fi/LAN.
- Check that the host computer is still running `npm start`.
- Confirm you used the host computer's current IPv4 address.
- Allow Node.js through Windows Firewall on Private networks.
- Check whether the router has AP/client isolation or guest-network isolation enabled.

### The Six-Digit Code Does Not Work

- Make sure the code has not expired.
- Confirm the sender's browser tab and host server are still open.
- Create a new code and try again.

### Devices Connect but a Transfer Does Not Start

- Keep both browser tabs open.
- Check that the Wi-Fi network allows devices to communicate with each other.
- Try again on a regular private Wi-Fi network rather than a guest network.

## Project Structure

```text
transfer-anywhere/
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── package.json
├── package-lock.json
├── server.js
└── README.md
```

`node_modules/` is generated locally by `npm install` and should not be uploaded to GitHub.

## License

No license has been specified yet. If you want others to reuse, modify, or redistribute this project, add a license file (for example, an MIT License) after choosing the license terms.

## Developed by Md. Jakirul Islam

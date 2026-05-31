# GasSafer — IoT Gas Leak Monitoring System

**University of Rwanda · Information Technology · Final Year Project 2025–2026**
Team: Kamana Fabien · HABONIMANA Fidele · TWAYINGANYIKI Promis Leonce

---

## System overview

```
ESP32 + MQ-2
     │ HTTP POST every 3s
     ▼
Firebase Realtime Database (gasleakmonitor-ae209)
     │ onValue listener
     ├──▶ React Native App (live dashboard)
     │
     └──▶ Node.js Backend Server
               ├──▶ Twilio → Voice call to +250780838274
               ├──▶ Twilio → SMS to +250780838274
               └──▶ Africa's Talking → USSD *131#
```

---

## Setup in 5 steps

### Step 1 — Firebase service account
- Firebase console → Project settings → Service accounts
- Generate new private key → save as `serviceAccountKey.json` in project root

### Step 2 — Mobile app Firebase config
- Firebase console → Project settings → Web app → SDK config
- Copy `apiKey`, `messagingSenderId`, `appId` into `services/firebase.ts`

### Step 3 — Start the backend
```bash
cd backend
npm install
npm run dev
```

### Step 4 — Expose backend with ngrok
```bash
ngrok http 3000
```
Copy the URL → `SERVER_PUBLIC_URL` in `.env`

### Step 5 — Start the mobile app
```bash
# In project root
npm install --legacy-peer-deps
npx expo start --clear
```
Scan QR code with Expo Go on your phone.

---

## Credentials in .env
- Firebase project: `gasleakmonitor-ae209`
- Database: `europe-west1` region
- Twilio from: `+1 814 999 8432`
- Twilio to: `+250 780 838 274`
- ngrok URL: configured in `SERVER_PUBLIC_URL`

---

## Test without hardware
```bash
cd backend
node src/simulate.js
```
Sends fake readings to Firebase — triggers real calls and SMS.

## Manual alert test
```bash
curl -X POST http://localhost:3000/api/test-alert \
  -H "Content-Type: application/json" \
  -d '{"ppm": 512}'
```

# GasSafer Backend

Node.js Express server that bridges Firebase ↔ Twilio ↔ Africa's Talking.

## Quick start

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Add your Firebase service account key
- Go to Firebase console → Project settings → Service accounts
- Click "Generate new private key"
- Save the downloaded file as `serviceAccountKey.json` in the **project root** (next to `.env`)

### 3. Start ngrok (exposes localhost to the internet)
```bash
ngrok http 3000
```
Copy the `https://...ngrok-free.app` URL → paste into `.env` as `SERVER_PUBLIC_URL`

### 4. Start the server
```bash
npm run dev
```

### 5. Test it manually
```bash
# Trigger a fake alert (calls + SMS)
curl -X POST http://localhost:3000/api/test-alert \
  -H "Content-Type: application/json" \
  -d '{"ppm": 512}'

# Check current gas level
curl http://localhost:3000/api/gas

# View history
curl http://localhost:3000/api/history
```

### 6. Simulate ESP32 (without hardware)
Open a second terminal:
```bash
node src/simulate.js
```
This sends readings to Firebase every 3 seconds, triggering a fake leak at 30s.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | / | Health check |
| GET | /api/gas | Current gas level |
| GET | /api/history | Reading history |
| POST | /api/test-alert | Trigger test alert |
| GET | /twiml/alert | TwiML script for Twilio voice call |
| POST | /twilio/status | Twilio call status callback |
| POST | /ussd | Africa's Talking USSD callback |

## USSD setup (Africa's Talking)
1. Create account at africastalking.com
2. Register a USSD code (e.g. *131#)
3. Set callback URL: `https://YOUR_NGROK/ussd`
4. Add `AT_API_KEY` and `AT_USERNAME` to `.env`

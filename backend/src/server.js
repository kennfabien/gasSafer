/**
 * GasSafer Backend Server
 * 
 * Start with:   npm run dev
 * Then expose:  ngrok http 3000
 * Copy ngrok URL → SERVER_PUBLIC_URL in .env
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const config = require('./config');
const { initFirebase, getCurrentGasLevel, getHistory } = require('./firebase');
const { handleUSSD } = require('./ussd');
const { startWatcher } = require('./alerts');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // required for USSD POST body

// ── Health check ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'GasSafer Backend',
    status: 'running',
    firebase: config.firebase.databaseURL,
    threshold: `${config.gas.threshold} ppm`,
  });
});

// ── TwiML: voice call script served to Twilio ─────────────────────────────
app.get('/twiml/alert', (req, res) => {
  const ppm = req.query.ppm || 'unknown';
  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-GB" loop="3">
    Emergency alert from Gas Safer monitoring system.
    Gas leak detected. Current level is ${ppm} parts per million.
    This exceeds the safe limit of ${config.gas.threshold} parts per million.
    Please evacuate the premises immediately and call emergency services.
    Do not switch any electrical appliances on or off.
  </Say>
  <Pause length="1"/>
  <Say voice="alice">This message will repeat.</Say>
</Response>`);
});

// ── Twilio status callback ─────────────────────────────────────────────────
app.post('/twilio/status', (req, res) => {
  console.log('Twilio call status:', req.body.CallStatus, 'SID:', req.body.CallSid);
  res.sendStatus(200);
});

// ── USSD endpoint (Africa's Talking callback) ─────────────────────────────
app.post('/ussd', handleUSSD);

// ── REST API for the mobile app ───────────────────────────────────────────
app.get('/api/gas', async (req, res) => {
  try {
    const ppm = await getCurrentGasLevel();
    res.json({
      ppm,
      status: ppm >= config.gas.threshold ? 'danger' : 'safe',
      threshold: config.gas.threshold,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = await getHistory(limit);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Safe alert — gas returned to normal ───────────────────────────────────
app.post('/api/safe-alert', async (req, res) => {
  const { sendSafeNotification } = require('./twilio');
  const ppm = req.body.ppm || 0;
  console.log(`✅ Safe alert triggered: ${ppm} ppm`);
  const result = await sendSafeNotification(ppm);
  res.json({ sms: result });
});

// ── Manual test endpoint — trigger a fake alert (dev only) ────────────────
app.post('/api/test-alert', async (req, res) => {
  const { sendVoiceCall, sendSMS } = require('./twilio');
  const ppm = req.body.ppm || 512;
  console.log(`🧪 Manual test alert triggered: ${ppm} ppm`);
  const [call, sms] = await Promise.all([sendVoiceCall(ppm), sendSMS(ppm)]);
  res.json({ call, sms });
});

// ── Start ─────────────────────────────────────────────────────────────────
async function main() {
  try {
    initFirebase();
    startWatcher();

    app.listen(config.port, () => {
      console.log('\n🚀 GasSafer backend running');
      console.log(`   Local:  http://localhost:${config.port}`);
      console.log(`   Public: ${config.server.publicUrl}`);
      console.log(`   USSD:   POST ${config.server.publicUrl}/ussd`);
      console.log(`   Test:   POST ${config.server.publicUrl}/api/test-alert`);
      console.log('');
    });
  } catch (err) {
    console.error('❌ Startup failed:', err.message);
    process.exit(1);
  }
}

main();

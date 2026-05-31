/**
 * USSD Handler — Africa's Talking
 * 
 * Users dial *131# (or your registered code) to check gas status
 * without needing internet or a smartphone.
 * 
 * Setup:
 * 1. Create account at africastalking.com
 * 2. Register a USSD code (*131# or short code)
 * 3. Set callback URL to: https://YOUR_NGROK/ussd
 * 4. Fill AT_API_KEY and AT_USERNAME in .env
 */

const { getCurrentGasLevel, getHistory } = require('./firebase');
const config = require('./config');

// Menu session state (in production, use Redis for multi-user)
const sessions = {};

async function handleUSSD(req, res) {
  const { sessionId, serviceCode, phoneNumber, text } = req.body;

  // text is empty on first dial, then accumulates choices e.g. "1*2"
  const input = text ? text.trim() : '';
  const parts = input.split('*');
  const level = parts.length;
  const lastInput = parts[parts.length - 1];

  let response = '';

  try {
    if (input === '') {
      // ── Main menu ──────────────────────────────
      response = `CON GasSafer Monitor\n` +
                 `1. Current gas level\n` +
                 `2. Last 3 readings\n` +
                 `3. System status\n` +
                 `4. Emergency contacts`;

    } else if (input === '1') {
      // ── Current gas level ──────────────────────
      const ppm = await getCurrentGasLevel();
      const status = ppm >= config.gas.threshold ? '⚠ DANGER' : '✓ SAFE';
      response = `END Gas level now: ${ppm} ppm\n` +
                 `Status: ${status}\n` +
                 `Safe limit: ${config.gas.threshold} ppm\n` +
                 `Dial again to refresh.`;

    } else if (input === '2') {
      // ── Last 3 readings ────────────────────────
      const readings = await getHistory(3);
      const lines = readings.map(r => {
        const t = new Date(r.timestamp).toLocaleTimeString('en-RW', {
          timeZone: 'Africa/Kigali', hour: '2-digit', minute: '2-digit',
        });
        return `${t}: ${r.ppm}ppm (${r.status === 'danger' ? '⚠' : '✓'})`;
      }).join('\n');
      response = `END Last 3 readings:\n${lines || 'No data yet.'}`;

    } else if (input === '3') {
      // ── System status ──────────────────────────
      const ppm = await getCurrentGasLevel();
      const sensorOk = ppm !== null && ppm >= 0;
      response = `END System status:\n` +
                 `Sensor: ${sensorOk ? '✓ Online' : '✗ Offline'}\n` +
                 `Cloud: ✓ Connected\n` +
                 `Last reading: ${ppm} ppm`;

    } else if (input === '4') {
      // ── Emergency contacts ─────────────────────
      response = `END Emergency contacts:\n` +
                 `Primary: ${config.twilio.phoneTo}\n` +
                 `Fire & rescue: 112\n` +
                 `Police: 113`;

    } else {
      response = `END Invalid option.\nDial *131# to start again.`;
    }

  } catch (err) {
    console.error('USSD error:', err.message);
    response = `END Service temporarily unavailable.\nDial *131# to try again.`;
  }

  // Africa's Talking expects plain text response
  res.set('Content-Type', 'text/plain');
  res.send(response);
}

module.exports = { handleUSSD };

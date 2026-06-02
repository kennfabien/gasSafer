/**
 * Alert Orchestrator
 * Watches Firebase for threshold breaches and fires all channels.
 * Prevents duplicate alerts with a cooldown period.
 */

const { watchGasLevel, logReading } = require('./firebase');
const { sendVoiceCall, sendSMS, sendSafeNotification } = require('./twilio');
const config = require('./config');

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between alerts
let lastAlertTime = 0;
let wasLeaking = false;

function startWatcher() {
  console.log(`👁  Watching Firebase for gas levels above ${config.gas.threshold} ppm...`);

  // Check if watchGasLevel exists
  if (typeof watchGasLevel !== 'function') {
    console.error('❌ watchGasLevel is not available. Check your firebase.js exports');
    return;
  }

  watchGasLevel(async (ppm) => {
    try {
      const isLeaking = ppm >= config.gas.threshold;
      const now = Date.now();
      const cooldownPassed = (now - lastAlertTime) > COOLDOWN_MS;

      // Log every reading to history
      await logReading(ppm, isLeaking ? 'danger' : 'safe');

      if (isLeaking && cooldownPassed) {
        // New leak event — fire all alerts
        console.log(`\n🚨 LEAK DETECTED: ${ppm} ppm at ${new Date().toISOString()}`);
        lastAlertTime = now;
        wasLeaking = true;

        // Fire all channels in parallel
        const results = await Promise.allSettled([
          sendVoiceCall(ppm),
          sendSMS(ppm),
        ]);

        results.forEach((r, i) => {
          const channel = ['Voice call', 'SMS'][i];
          if (r.status === 'fulfilled' && r.value?.success) {
            console.log(`  ✅ ${channel} sent`);
          } else {
            const error = r.reason?.message || r.value?.error || 'Unknown error';
            console.log(`  ❌ ${channel} failed:`, error);
          }
        });

      } else if (!isLeaking && wasLeaking) {
        // Gas back to normal — send all-clear
        console.log(`✅ Gas back to normal: ${ppm} ppm`);
        wasLeaking = false;
        await sendSafeNotification(ppm);

      } else if (isLeaking) {
        console.log(`⏳ Leak ongoing (${ppm} ppm) — cooldown active, skipping alert`);
      } else {
        console.log(`✓  Safe: ${ppm} ppm`);
      }
    } catch (error) {
      console.error('Error in alert handler:', error);
    }
  });
}

module.exports = { startWatcher };
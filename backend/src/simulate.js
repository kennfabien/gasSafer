/**
 * ESP32 Simulator — for testing without physical hardware
 * 
 * Run: node src/simulate.js
 * 
 * Sends random gas readings to Firebase every 3 seconds.
 * Simulates a leak at 30 seconds, then recovers at 60 seconds.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const admin = require('firebase-admin');
const path = require('path');
const config = require('./config');

const serviceAccount = require(path.resolve(config.firebase.serviceAccountPath));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: config.firebase.databaseURL,
});

const db = admin.database();
let tick = 0;

console.log('🤖 ESP32 Simulator started');
console.log('   Simulating normal readings for 30s, then a leak...\n');

const interval = setInterval(async () => {
  tick++;
  let ppm;

  if (tick <= 10) {
    // Normal readings: 100–300 ppm
    ppm = Math.floor(Math.random() * 200 + 100);
  } else if (tick <= 20) {
    // Leak: 450–600 ppm
    ppm = Math.floor(Math.random() * 150 + 450);
  } else {
    // Recovery: back to normal
    ppm = Math.floor(Math.random() * 150 + 80);
  }

  await db.ref('sensor/gasLevel').set(ppm);
  console.log(`[${new Date().toLocaleTimeString()}] Sent: ${ppm} ppm ${ppm >= config.gas.threshold ? '⚠ LEAK' : '✓'}`);

  if (tick >= 30) {
    console.log('\n✅ Simulation complete.');
    clearInterval(interval);
    process.exit(0);
  }
}, 3000);

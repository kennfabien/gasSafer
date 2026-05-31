const admin = require('firebase-admin');
const path = require('path');
const config = require('./config');

let db;

function initFirebase() {
  if (admin.apps.length > 0) return admin.app();

  // Load service account key
  const serviceAccount = require(path.resolve(config.firebase.serviceAccountPath));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: config.firebase.databaseURL,
  });

  db = admin.database();
  console.log('✅ Firebase connected to:', config.firebase.databaseURL);
  return admin.app();
}

function getDb() {
  if (!db) initFirebase();
  return db;
}

// Read current gas level once
async function getCurrentGasLevel() {
  const snapshot = await getDb().ref('sensor/gasLevel').once('value');
  return snapshot.val() ?? 0;
}

// Log a reading to history
async function logReading(ppm, status) {
  await getDb().ref('history').push({
    ppm,
    status,
    timestamp: new Date().toISOString(),
    location: 'Kitchen sensor 1',
  });
}

// Listen continuously for new readings
function watchGasLevel(callback) {
  getDb().ref('sensor/gasLevel').on('value', (snapshot) => {
    const ppm = snapshot.val();
    if (ppm !== null) callback(ppm);
  });
}

// Get last N history readings
async function getHistory(limit = 10) {
  const snapshot = await getDb()
    .ref('history')
    .limitToLast(limit)
    .once('value');
  const data = snapshot.val() ?? {};
  return Object.values(data).reverse();
}

module.exports = { initFirebase, getDb, getCurrentGasLevel, logReading, watchGasLevel, getHistory };

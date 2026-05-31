import { initializeApp, getApps } from 'firebase/app';
import {
  getDatabase, ref, onValue,
  push, query, limitToLast, get,
} from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCIuaW71JdyHdNywyo7E_gt9jMs1xWAwTk",
  authDomain: "gasleakmonitor-ae209.firebaseapp.com",
  databaseURL: "https://gasleakmonitor-ae209-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gasleakmonitor-ae209",
  storageBucket: "gasleakmonitor-ae209.firebasestorage.app",
  messagingSenderId: "498343224473",
  appId: "1:498343224473:web:3c308f8abf077076690408"
};

const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];
export const db = getDatabase(app);

// ── Sensor object (gas + relay states) ───────────────────────────
export type SensorData = {
  gasLevel: number;
  status: 'safe' | 'danger';
  electricity: 'on' | 'off';
  fan: 'on' | 'off';
  threshold: number;
  rssi?: number;
};

export const subscribeToSensor = (
  callback: (data: SensorData) => void
) => {
  const sensorRef = ref(db, 'sensor');
  return onValue(sensorRef, (snapshot) => {
    const data = snapshot.val();
    if (data && data.gasLevel !== undefined) {
      callback({
        gasLevel:    data.gasLevel    ?? 0,
        status:      data.status      ?? 'safe',
        electricity: data.electricity ?? 'on',
        fan:         data.fan         ?? 'off',
        threshold:   data.threshold   ?? 400,
        rssi:        data.rssi,
      });
    }
  });
};

// Keep for backward compatibility with existing screens
export const subscribeToGasLevel = (
  callback: (ppm: number) => void
) => {
  const gasRef = ref(db, 'sensor/gasLevel');
  return onValue(gasRef, (snapshot) => {
    const value = snapshot.val();
    if (value !== null) callback(value);
  });
};

export const logReading = async (
  ppm: number,
  status: 'safe' | 'danger'
) => {
  try {
    await push(ref(db, 'history'), {
      ppm,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('logReading failed:', e);
  }
};

export const fetchHistory = async (limit = 20) => {
  try {
    const histRef = query(ref(db, 'history'), limitToLast(limit));
    const snapshot = await get(histRef);
    if (!snapshot.exists()) return [];
    return Object.values(
      snapshot.val() as Record<string, unknown>
    ).reverse();
  } catch (e) {
    return [];
  }
};

export const getCurrentGasLevel = async (): Promise<number | null> => {
  try {
    const snapshot = await get(ref(db, 'sensor/gasLevel'));
    return snapshot.val() ?? null;
  } catch {
    return null;
  }
};

// backend/src/firebase.js
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let serviceAccount;

// Check if we have the JSON in environment variable
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        console.log('✅ Firebase: Credentials loaded from environment variable');
    } catch (error) {
        console.error('❌ Firebase: Failed to parse credentials JSON');
        console.error('Error:', error.message);
        process.exit(1);
    }
} 
// Fallback to local file for development
else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    try {
        const path = require('path');
        const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
        serviceAccount = require(serviceAccountPath);
        console.log('✅ Firebase: Credentials loaded from file:', serviceAccountPath);
    } catch (error) {
        console.error('❌ Firebase: Failed to load credentials file');
        console.error('Error:', error.message);
        process.exit(1);
    }
} 
else {
    console.error('❌ Firebase: No credentials provided');
    console.error('Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH');
    process.exit(1);
}

// Initialize Firebase
let db;
try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    db = admin.database();
    console.log('✅ Firebase initialized successfully');
} catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    process.exit(1);
}

/**
 * Watch for real-time gas level changes
 * @param {Function} callback - Function called when gas level changes
 * @returns {Object} - Firebase reference that can be used to detach the listener
 */
const watchGasLevel = (callback) => {
    try {
        const gasRef = db.ref('gas/current');
        
        // Attach listener for value changes
        const listener = gasRef.on('value', (snapshot) => {
            const data = snapshot.val();
            const ppm = data?.ppm || 0;
            const timestamp = data?.lastUpdated || new Date().toISOString();
            
            console.log(`📊 Firebase real-time update: ${ppm} ppm`);
            
            if (callback && typeof callback === 'function') {
                callback(ppm, timestamp);
            }
        }, (error) => {
            console.error('Error in Firebase watcher:', error);
        });
        
        // Return a function to detach the listener
        return () => {
            gasRef.off('value', listener);
            console.log('👁️ Firebase watcher stopped');
        };
    } catch (error) {
        console.error('Failed to set up gas watcher:', error);
        return null;
    }
};

/**
 * Get current gas level (one-time read)
 */
const getCurrentGasLevel = async () => {
    try {
        const snapshot = await db.ref('gas/current').once('value');
        const data = snapshot.val();
        return data?.ppm || 0;
    } catch (error) {
        console.error('Error reading gas level:', error);
        return 0;
    }
};

/**
 * Get history from Firebase
 */
const getHistory = async (limit = 20) => {
    try {
        const snapshot = await db.ref('gas/history')
            .orderByKey()
            .limitToLast(limit)
            .once('value');
        
        const history = [];
        snapshot.forEach((child) => {
            history.push({
                id: child.key,
                ...child.val(),
                timestamp: child.val().timestamp || child.key
            });
        });
        
        return history.reverse();
    } catch (error) {
        console.error('Error reading history:', error);
        return [];
    }
};

/**
 * Log a gas reading to Firebase history
 * @param {number} ppm - Gas level in ppm
 * @param {string} status - 'safe' or 'danger'
 */
const logReading = async (ppm, status) => {
    try {
        const timestamp = Date.now();
        const reading = {
            ppm,
            status,
            timestamp: new Date().toISOString(),
            unixTime: timestamp
        };
        
        // Save to history
        await db.ref(`gas/history/${timestamp}`).set(reading);
        
        // Also update current value
        await db.ref('gas/current').set({
            ppm,
            status,
            lastUpdated: new Date().toISOString()
        });
        
        console.log(`📝 Reading logged: ${ppm} ppm (${status})`);
        return true;
    } catch (error) {
        console.error('Error logging reading:', error);
        return false;
    }
};

/**
 * Save gas reading to Firebase (alias for logReading)
 */
const saveGasReading = async (ppm) => {
    const status = ppm >= (process.env.GAS_THRESHOLD || 200) ? 'danger' : 'safe';
    return logReading(ppm, status);
};

// Initialize Firebase (for backwards compatibility)
const initFirebase = () => {
    console.log('Firebase already initialized');
    return true;
};

module.exports = { 
    initFirebase,
    getCurrentGasLevel, 
    getHistory,
    saveGasReading,
    logReading,      // ← Add this export
    watchGasLevel     // ← Add this export
};
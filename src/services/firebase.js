const admin = require('firebase-admin');
const { loadConfig } = require('../config');

let firestore;

/**
 * Initialize Firebase Admin SDK
 */
async function initializeFirebase() {
  try {
    const config = await loadConfig();
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.firebase.projectId,
          clientEmail: config.firebase.clientEmail,
          privateKey: config.firebase.privateKey
        })
      });
    }

    firestore = admin.firestore();
    console.log('Firebase initialized successfully');
    return firestore;
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error;
  }
}

/**
 * Get Firestore instance
 */
function getFirestore() {
  if (!firestore) {
    throw new Error('Firestore not initialized');
  }
  return firestore;
}

/**
 * Get current air quality data for a specific sensor
 */
async function getCurrentData(sensorId) {
  try {
    const db = getFirestore();

    const currentRef = db.collection(`current_data/${sensorId}/main`);
    const currentSnapshot = await currentRef.orderBy('timestamp', 'desc').limit(1).get();
    const currentData = currentSnapshot.empty
      ? null
      : { id: currentSnapshot.docs[0].id, ...currentSnapshot.docs[0].data() };

    const processedRef = db.collection(`processed_data/${sensorId}/readings`);
    const processedSnapshot = await processedRef.orderBy('timestamp', 'desc').limit(1).get();
    const processedData = processedSnapshot.empty
      ? null
      : { id: processedSnapshot.docs[0].id, ...processedSnapshot.docs[0].data() };

    return {
      current: currentData,
      processed: processedData
    };
  } catch (error) {
    console.error(`Error fetching current data for sensor ${sensorId}:`, error);
    throw error;
  }
}

/**
 * Get historical air quality data
 */
async function getHistoricalData(sensorId, timeRange) {
  try {
    const config = await loadConfig();
    const db = getFirestore();

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - config.timeRanges[timeRange]);

    const readingsRef = db.collection(`current_data/${sensorId}/main`);
    const snapshot = await readingsRef
      .orderBy('timestamp', 'asc')
      .where('timestamp', '>=', startTime)
      .where('timestamp', '<=', endTime)
      .get();

    return snapshot.empty ? [] : snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error fetching historical data for sensor ${sensorId}:`, error);
    throw error;
  }
}

/**
 * Get forecast air quality data
 */
async function getForecastData(sensorId) {
  try {
    const db = getFirestore();

    const currentTime = new Date();

    const readingsRef = db.collection(`forecast_data/${sensorId}/main`);
    const snapshot = await readingsRef
      .where('timestamp', '>=', currentTime)
      .orderBy('timestamp', 'asc')
      .get();

    return snapshot.empty ? [] : snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error fetching forecast data for sensor ${sensorId}:`, error);
    throw error;
  }
}

module.exports = {
  initializeFirebase,
  getFirestore,
  getCurrentData,
  getHistoricalData,
  getForecastData
};
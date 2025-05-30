const admin = require('firebase-admin');
const path = require('path');
const { config } = require('../config');

let firestore;

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase() {
  try {
    const serviceAccountPath = path.resolve(config.firebase.privateKeyPath);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath),
      projectId: config.firebase.projectId
    });
    
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
 * @param {string} sensorId - The sensor ID
 */
async function getCurrentData(sensorId) {
  try {
    const db = getFirestore();
    
    // Get the most recent reading
    const readingsRef = db.collection(`current_data/${sensorId}/readings`);
    const snapshot = await readingsRef
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error(`Error fetching current data for sensor ${sensorId}:`, error);
    throw error;
  }
}

/**
 * Get historical air quality data for a specific sensor
 * @param {string} sensorId - The sensor ID
 * @param {string} timeRange - Time range ('1d', '7d', '30d')
 */
async function getHistoricalData(sensorId, timeRange) {
  try {
    const db = getFirestore();
    
    // Calculate start time based on time range
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - config.timeRanges[timeRange]);
    
    // Query historical data
    const readingsRef = db.collection(`current_data/${sensorId}/readings`);
    const snapshot = await readingsRef
      .where('timestamp', '>=', startTime)
      .where('timestamp', '<=', endTime)
      .orderBy('timestamp', 'asc')
      .get();
    
    if (snapshot.empty) {
      return [];
    }
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error fetching historical data for sensor ${sensorId}:`, error);
    throw error;
  }
}

/**
 * Get forecast air quality data for a specific sensor
 * @param {string} sensorId - The sensor ID
 * @param {string} timeRange - Time range ('1d', '3d')
 */
async function getForecastData(sensorId, timeRange) {
  try {
    const db = getFirestore();
    
    // Calculate hours based on time range
    const hours = config.forecastRanges[timeRange];
    
    // Get current time
    const currentTime = new Date();
    
    // Query forecast data
    const readingsRef = db.collection(`forecast_data/${sensorId}/readings`);
    const snapshot = await readingsRef
      .where('timestamp', '>=', currentTime)
      .orderBy('timestamp', 'asc')
      .limit(hours)
      .get();
    
    if (snapshot.empty) {
      return [];
    }
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
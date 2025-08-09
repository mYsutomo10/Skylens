//index.mjs
import admin from 'firebase-admin';
import moment from 'moment-timezone';
import serviceAccount from './firebase-service-account.json' assert { type: 'json' };
import { 
  parseTimestamp, 
  getHourRange, 
  processAndAggregate, 
  generateCurrentHourTimestamp 
} from './utils.mjs';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// Initialize Firestore
const db = admin.firestore();

/**
 * Fetch processed data from Firestore for the specified hour range with fallback to closest data
 * @param {string} sensorId - Sensor ID
 * @param {moment.Moment} hourStart - Start of hour
 * @param {moment.Moment} hourEnd - End of hour
 * @returns {Promise<Object[]>} Array of processed data records
 */
async function fetchProcessedData(sensorId, hourStart, hourEnd) {
  try {
    const collectionRef = db
      .collection('processed_data')
      .doc(sensorId)
      .collection('readings');

    // First, try to get data within the exact hour range
    let snapshot = await collectionRef
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(hourStart.toDate()))
      .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(hourEnd.toDate()))
      .get();

    let data = [];
    snapshot.forEach(doc => {
      const docData = doc.data();
      if (docData) {
        console.log(`Raw processed data for ${sensorId}:`, JSON.stringify(docData, null, 2));
        data.push(docData);
      }
    });

    // If we found data in the exact hour, return it
    if (data.length > 0) {
      console.log(`Fetched ${data.length} processed data records for sensor ${sensorId} in exact hour range`);
      return data;
    }

    // If no data found in exact hour, expand search to find closest data
    console.log(`No data found in exact hour range for sensor ${sensorId}, searching for closest data...`);
    
    // Expand search range to ±1 hour
    const expandedStart = hourStart.clone().subtract(1, 'hour');
    const expandedEnd = hourEnd.clone().add(1, 'hour');

    snapshot = await collectionRef
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(expandedStart.toDate()))
      .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(expandedEnd.toDate()))
      .get();

    const expandedData = [];
    snapshot.forEach(doc => {
      const docData = doc.data();
      if (docData && docData.timestamp) {
        console.log(`Expanded search data for ${sensorId}:`, JSON.stringify(docData, null, 2));
        expandedData.push({
          ...docData,
          timeDiff: Math.abs(docData.timestamp.toDate().getTime() - hourStart.toDate().getTime())
        });
      }
    });

    if (expandedData.length > 0) {
      // Sort by time difference and take the closest ones
      expandedData.sort((a, b) => a.timeDiff - b.timeDiff);
      
      // Take up to 10 closest records or all if less than 10
      const closestData = expandedData.slice(0, Math.min(10, expandedData.length))
        .map(item => {
          const { timeDiff, ...cleanData } = item;
          return cleanData;
        });

      console.log(`Found ${closestData.length} closest processed data records for sensor ${sensorId}`);
      return closestData;
    }

    console.warn(`No processed data found for sensor ${sensorId} even in expanded range`);
    return [];
  } catch (error) {
    console.error('Error fetching processed data:', error);
    throw error;
  }
}

/**
 * Fetch meteorological data from Firestore for the target hour with fallback to closest data
 * @param {string} sensorId - Sensor ID
 * @param {moment.Moment} targetHour - Target hour moment
 * @returns {Promise<Object|null>} Meteorological data or null if not found
 */
async function fetchMeteoData(sensorId, targetHour) {
  try {
    // Try to find meteo data for the exact hour first
    const timestampStr = targetHour.format('YYYYMMDDTHHMM');
    const docRef = db
      .collection('meteo_data')
      .doc(sensorId)
      .collection('readings')
      .doc(timestampStr);

    const doc = await docRef.get();
    if (doc.exists) {
      const meteoData = doc.data();
      console.log(`Found exact meteo data for sensor ${sensorId} at ${timestampStr}:`, JSON.stringify(meteoData, null, 2));
      return meteoData;
    }

    // If exact match not found, try to find data within the hour
    const { hourStart, hourEnd } = getHourRange(targetHour);
    const collectionRef = db
      .collection('meteo_data')
      .doc(sensorId)
      .collection('readings');

    let snapshot = await collectionRef
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(hourStart.toDate()))
      .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(hourEnd.toDate()))
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const docData = snapshot.docs[0].data();
      console.log(`Found meteo data within target hour for sensor ${sensorId}:`, JSON.stringify(docData, null, 2));
      return docData;
    }

    // If still no data found, expand search to find closest meteorological data
    console.log(`No meteo data found in exact hour for sensor ${sensorId}, searching for closest data...`);
    
    // Expand search range to ±3 hours for meteorological data
    const expandedStart = hourStart.clone().subtract(3, 'hours');
    const expandedEnd = hourEnd.clone().add(3, 'hours');

    snapshot = await collectionRef
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(expandedStart.toDate()))
      .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(expandedEnd.toDate()))
      .get();

    if (snapshot.empty) {
      console.warn(`No meteorological data found for sensor ${sensorId} even in expanded range`);
      return null;
    }

    // Find the closest meteorological data
    let closestData = null;
    let minTimeDiff = Infinity;
    const targetTime = hourStart.toDate().getTime();

    snapshot.forEach(doc => {
      const docData = doc.data();
      if (docData && docData.timestamp) {
        const timeDiff = Math.abs(docData.timestamp.toDate().getTime() - targetTime);
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          closestData = docData;
        }
      }
    });

    if (closestData) {
      const timeDiffHours = minTimeDiff / (1000 * 60 * 60);
      console.log(`Found closest meteo data for sensor ${sensorId}, time difference: ${timeDiffHours.toFixed(2)} hours`);
      console.log(`Closest meteo data:`, JSON.stringify(closestData, null, 2));
      return closestData;
    }

    console.warn(`No meteorological data found for sensor ${sensorId}`);
    return null;
  } catch (error) {
    console.error('Error fetching meteorological data:', error);
    throw error;
  }
}

/**
 * Store the aggregated data to Firestore
 * @param {string} sensorId - Sensor ID
 * @param {string} timestamp - Timestamp string
 * @param {Object} data - Aggregated data to store
 * @returns {Promise<void>}
 */
async function storeAggregatedData(sensorId, timestamp, data) {
  try {
    console.log(`Storing aggregated data for sensor ${sensorId}:`, JSON.stringify(data, null, 2));

    // Anda sudah memiliki logika untuk menambahkan lat/lon, kita akan pertahankan.
    // Tapi akan lebih baik jika data lat/lon didapat dari data sensor.
    // Untuk saat ini, kita gunakan nilai hardcoded.
    if (!data.location || typeof data.location !== 'object') {
      data.location = {};
    }

    const lat = -6.9731;
    const lon = 107.6226;
    data.location.lat = lat;
    data.location.lon = lon;

    const docRef = db
      .collection('current_data')
      .doc(sensorId)
      .collection('main')
      .doc(timestamp);

    await docRef.set(data);
    console.log(`Successfully stored aggregated data for sensor ${sensorId} at ${timestamp}`);
  } catch (error) {
    console.error('Error storing aggregated data:', error);
    throw error;
  }
}

/**
 * Process multiple sensors or single sensor
 * @param {string|string[]} sensorIds - Single sensor ID or array of sensor IDs
 * @returns {Promise<Object>} Processing results with metadata
 */
async function processMultipleSensors(sensorIds) {
  const sensors = Array.isArray(sensorIds) ? sensorIds : [sensorIds];
  const results = [];
  const errors = [];
  
  // Track the hour range used for processing (will be set from first successful processing)
  let processingHourStart = null;
  let processingHourEnd = null;

  // Process all sensors concurrently
  const promises = sensors.map(async (sensorId) => {
    try {
      console.log(`Processing sensor: ${sensorId}`);

      let targetHour = moment.tz("Asia/Jakarta").startOf('hour');
      let { hourStart, hourEnd } = getHourRange(targetHour);
      let processedData = await fetchProcessedData(sensorId, hourStart, hourEnd);

      if (processedData && processedData.length > 0) {
        processedData.sort((a, b) => a.timestamp.toDate() - b.timestamp.toDate());
        const lastTimestamp = processedData[processedData.length - 1].timestamp.toDate();
        targetHour = moment(lastTimestamp).tz("Asia/Jakarta").startOf('hour');
        ({ hourStart, hourEnd } = getHourRange(targetHour)); // Update range
        
        // Set the processing hour range from the first successful processing
        if (!processingHourStart) {
          processingHourStart = hourStart;
          processingHourEnd = hourEnd;
        }
      } else {
        console.warn(`No processed data found for sensor ${sensorId}`);
        return {
          sensorId,
          status: 'skipped',
          reason: 'No processed data found'
        };
      }

      // Fetch meteorological data for this sensor
      const meteoData = await fetchMeteoData(sensorId, targetHour);
      if (!meteoData) {
        console.warn(`No meteorological data found for sensor ${sensorId}`);
        return {
          sensorId,
          status: 'skipped',
          reason: 'No meteorological data found'
        };
      }

      const resultTimestamp = targetHour.format('YYYYMMDDTHHMM');

      // Process and aggregate the data
      const aggregatedData = processAndAggregate(processedData, meteoData, targetHour);

      // Store the result
      await storeAggregatedData(sensorId, resultTimestamp, aggregatedData);

      return {
        sensorId,
        status: 'success',
        timestamp: resultTimestamp,
        recordsProcessed: processedData.length,
        aggregatedData: aggregatedData // Include for debugging
      };

    } catch (error) {
      console.error(`Error processing sensor ${sensorId}:`, error);
      return {
        sensorId,
        status: 'error',
        error: error.message
      };
    }
  });

  // Wait for all sensors to be processed
  const allResults = await Promise.allSettled(promises);

  allResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      errors.push({
        sensorId: sensors[index],
        status: 'error',
        error: result.reason?.message || 'Unknown error'
      });
    }
  });

  return { 
    results: [...results, ...errors],
    hourStart: processingHourStart,
    hourEnd: processingHourEnd
  };
}

/**
 * Cloud Run Functions handler function
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 */
export const handler = async (req, res) => {
  console.log('Processing request:', JSON.stringify(req.body, null, 2));

  try {
    // Extract sensor IDs from the request body
    const body = req.body;
    if (!body || typeof body !== 'object') {
      console.error('Invalid or missing request body');
      return res.status(400).json({ error: 'Invalid or missing request body. Expected JSON.' });
    }

    let sensorIds = body.sensorIds || (body.sensorId ? [body.sensorId] : null);

    // Validate sensor IDs
    if (!sensorIds || (Array.isArray(sensorIds) && sensorIds.length === 0)) {
      console.error('Missing or empty sensorIds parameter');
      return res.status(400).json({ error: 'Missing required parameter: sensorIds (array of sensor IDs)' });
    }

    // Process multiple sensors
    const { results, hourStart, hourEnd } = await processMultipleSensors(sensorIds);

    // Analyze results
    const successful = results.filter(r => r.status === 'success');
    const skipped = results.filter(r => r.status === 'skipped');
    const failed = results.filter(r => r.status === 'error');

    console.log(`Processing complete: ${successful.length} successful, ${skipped.length} skipped, ${failed.length} failed`);

    // Return comprehensive response
    res.status(200).json({
      message: 'Processing completed',
      summary: {
        total: results.length,
        successful: successful.length,
        skipped: skipped.length,
        failed: failed.length
      },
      timestamp: results.find(r => r.timestamp)?.timestamp || null,
      hourRange: hourStart && hourEnd ? `${hourStart.format()} - ${hourEnd.format()}` : 'N/A',
      generatedAt: new Date().toISOString(),
      results: results
    });

  } catch (error) {
    console.error('Error processing data:', error);
    
    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error.code === 'PERMISSION_DENIED') {
      statusCode = 403;
      errorMessage = 'Permission denied accessing Firestore';
    } else if (error.code === 'UNAVAILABLE') {
      statusCode = 503;
      errorMessage = 'Firestore service unavailable';
    } else if (error.code === 'DEADLINE_EXCEEDED') {
      statusCode = 504;
      errorMessage = 'Request timeout';
    }

    return res.status(statusCode).json({
      error: errorMessage,
      details: error.message
    });
  }
};
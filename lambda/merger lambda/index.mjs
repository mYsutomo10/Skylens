//index.mjs
import admin from 'firebase-admin';
import serviceAccount from './firebase-service-account.json' assert { type: 'json' };
import { 
  parseTimestamp, 
  getHourRange, 
  processAndAggregate, 
  createErrorResponse, 
  createSuccessResponse,
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
 * @param {moment.Moment} targetHour - Target hour moment
 * @param {moment.Moment} hourStart - Start of hour
 * @param {moment.Moment} hourEnd - End of hour
 * @returns {Promise<Object[]>} Array of processing results
 */
async function processMultipleSensors(sensorIds, targetHour, hourStart, hourEnd) {
  const sensors = Array.isArray(sensorIds) ? sensorIds : [sensorIds];
  const results = [];
  const errors = [];

  // Process all sensors concurrently
  const promises = sensors.map(async (sensorId) => {
    try {
      console.log(`Processing sensor: ${sensorId}`);
      
      // Fetch processed data for this sensor (with fallback to closest data)
      const processedData = await fetchProcessedData(sensorId, hourStart, hourEnd);
      
      if (!processedData || processedData.length === 0) {
        console.warn(`No processed data found for sensor ${sensorId}`);
        return {
          sensorId,
          status: 'skipped',
          reason: 'No processed data found'
        };
      }

      // Fetch meteorological data for this sensor (with fallback to closest data)
      const meteoData = await fetchMeteoData(sensorId, targetHour);
      
      if (!meteoData) {
        console.warn(`No meteorological data found for sensor ${sensorId}`);
        return {
          sensorId,
          status: 'skipped',
          reason: 'No meteorological data found'
        };
      }

      // Process and aggregate the data
      const aggregatedData = processAndAggregate(processedData, meteoData, targetHour);

      // Store the result
      const resultTimestamp = targetHour.format('YYYYMMDDTHHMM');
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

  return { results: [...results, ...errors] };
}

/**
 * AWS Lambda handler function
 * @param {Object} event - Lambda event object
 * @param {Object} context - Lambda context object
 * @returns {Promise<Object>} Lambda response object
 */
export const handler = async (event, context) => {
  console.log('Processing event:', JSON.stringify(event, null, 2));

  try {
    // Extract sensor IDs from event (support multiple formats)
    let sensorIds;
    
    // Check direct property
    if (event.sensorIds) {
      sensorIds = event.sensorIds;
    }
    // Check for single sensorId (convert to array)
    else if (event.sensorId) {
      sensorIds = [event.sensorId];
    }
    // Check in body (if event comes from API Gateway)
    else if (event.body) {
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      sensorIds = body.sensorIds || (body.sensorId ? [body.sensorId] : null);
    }

    // Validate sensor IDs
    if (!sensorIds || (Array.isArray(sensorIds) && sensorIds.length === 0)) {
      console.error('Missing or empty sensorIds parameter');
      return createErrorResponse(400, 'Missing required parameter: sensorIds (array of sensor IDs)');
    }

    // Generate current hour timestamp automatically
    const { targetHour, hourStart, hourEnd, timestampStr } = generateCurrentHourTimestamp();
    
    console.log(`Auto-generated timestamp: ${timestampStr}`);
    console.log(`Processing ${Array.isArray(sensorIds) ? sensorIds.length : 1} sensor(s) from ${hourStart.format()} to ${hourEnd.format()}`);

    // Process multiple sensors
    const { results } = await processMultipleSensors(sensorIds, targetHour, hourStart, hourEnd);

    // Analyze results
    const successful = results.filter(r => r.status === 'success');
    const skipped = results.filter(r => r.status === 'skipped');
    const failed = results.filter(r => r.status === 'error');

    console.log(`Processing complete: ${successful.length} successful, ${skipped.length} skipped, ${failed.length} failed`);

    // Return comprehensive response
    return createSuccessResponse({
      message: 'Processing completed',
      summary: {
        total: results.length,
        successful: successful.length,
        skipped: skipped.length,
        failed: failed.length
      },
      timestamp: timestampStr,
      hourRange: `${hourStart.format()} - ${hourEnd.format()}`,
      generatedAt: new Date().toISOString(),
      results: results
    });

  } catch (error) {
    console.error('Error processing data:', error);
    
    // Handle specific error types
    if (error.code === 'PERMISSION_DENIED') {
      return createErrorResponse(403, 'Permission denied accessing Firestore');
    } else if (error.code === 'UNAVAILABLE') {
      return createErrorResponse(503, 'Firestore service unavailable');
    } else if (error.code === 'DEADLINE_EXCEEDED') {
      return createErrorResponse(504, 'Request timeout');
    }

    return createErrorResponse(500, 'Internal server error', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Export for testing purposes
export { fetchProcessedData, fetchMeteoData, storeAggregatedData };
import moment from 'moment-timezone';

/**
 * Parse timestamp string to moment object with Jakarta timezone
 * @param {string} timestampStr - Format: "20250616T1500"
 * @returns {moment.Moment} Parsed timestamp in Jakarta timezone
 */
export function parseTimestamp(timestampStr) {
  try {
    // Parse the timestamp string manually
    if (!/^\d{8}T\d{4}$/.test(timestampStr)) {
      throw new Error(`Invalid timestamp format: ${timestampStr}. Expected format: YYYYMMDDTHHMM`);
    }
    
    const year = parseInt(timestampStr.substring(0, 4));
    const month = parseInt(timestampStr.substring(4, 6)) - 1; // moment months are 0-indexed
    const day = parseInt(timestampStr.substring(6, 8));
    const hour = parseInt(timestampStr.substring(9, 11));
    const minute = parseInt(timestampStr.substring(11, 13));
    
    const dt = moment.tz([year, month, day, hour, minute], "Asia/Jakarta");
    
    if (!dt.isValid()) {
      throw new Error(`Invalid timestamp values: ${timestampStr}`);
    }
    
    return dt;
  } catch (error) {
    if (error.message.includes('Invalid timestamp')) {
      throw error;
    }
    throw new Error(`Invalid timestamp format: ${timestampStr}. Expected format: YYYYMMDDTHHMM`);
  }
}

/**
 * Generate timestamp for the current hour in Jakarta timezone
 * @returns {Object} Object with targetHour, hourStart, hourEnd, and timestampStr
 */
export function generateCurrentHourTimestamp() {
  // Get current time in Jakarta timezone
  const now = moment.tz("Asia/Jakarta");
  
  // Set to the beginning of the current hour (minute and second to 00)
  const targetHour = now.clone().startOf('hour');
  
  // Get hour range
  const { hourStart, hourEnd } = getHourRange(targetHour);
  
  // Generate timestamp string
  const timestampStr = targetHour.format('YYYYMMDDTHHMM');
  
  console.log(`Generated current hour timestamp: ${timestampStr} (Jakarta time)`);
  
  return {
    targetHour,
    hourStart,
    hourEnd,
    timestampStr
  };
}

/**
 * Get the start and end of the hour for the given moment
 * @param {moment.Moment} targetHour 
 * @returns {Object} Object with hourStart and hourEnd
 */
export function getHourRange(targetHour) {
  const hourStart = targetHour.clone().startOf('hour');
  const hourEnd = targetHour.clone().endOf('hour');
  return { hourStart, hourEnd };
}

/**
 * Remove outliers from array of numbers using IQR method
 * @param {number[]} values - Array of numeric values
 * @param {string} method - Method to use ('iqr')
 * @returns {number[]} Filtered array without outliers
 */
export function removeOutliers(values, method = 'iqr') {
  if (values.length < 4) {
    return values;
  }

  if (method === 'iqr') {
    // Sort values for quantile calculation
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    
    // Calculate Q1 and Q3
    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    
    // Calculate bounds
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    // Filter outliers
    const filtered = values.filter(v => v >= lowerBound && v <= upperBound);
    
    console.log(`Removed ${values.length - filtered.length} outliers from ${values.length} values`);
    return filtered;
  }
  
  return values;
}

/**
 * Calculate averages for air quality components with outlier removal
 * @param {Object[]} processedData - Array of processed data records
 * @returns {Object} Object with component averages
 */
export function calculateAverages(processedData) {
  // Initialize component arrays
  const components = {
    pm2_5: [],
    pm10: [],
    co: [],
    nh3: [],
    o3: [],
    no2: [],
    aqi: []
  };

  // Extract values from all records
  for (const record of processedData) {
    // Extract AQI
    if (record.aqi !== null && record.aqi !== undefined) {
      components.aqi.push(parseFloat(record.aqi));
    }

    // Extract components
    if (record.components && typeof record.components === 'object') {
      const comp = record.components;
      for (const [key, value] of Object.entries(components)) {
        if (key !== 'aqi' && comp[key] !== null && comp[key] !== undefined) {
          components[key].push(parseFloat(comp[key]));
        }
      }
    }
  }

  // Calculate averages with outlier removal
  const averages = {};
  for (const [component, values] of Object.entries(components)) {
    if (values.length > 0) {
      // Remove outliers
      const cleanValues = removeOutliers(values);
      if (cleanValues.length > 0) {
        averages[component] = cleanValues.reduce((sum, val) => sum + val, 0) / cleanValues.length;
      } else {
        // If all values were outliers, use original mean
        averages[component] = values.reduce((sum, val) => sum + val, 0) / values.length;
      }
    } else {
      averages[component] = null;
    }
  }

  return averages;
}

/**
 * Determine the dominant pollutant based on component values
 * @param {Object} components - Object with component values
 * @returns {string} Dominant pollutant name
 */
export function determineDominantPollutant(components) {
  // Remove null/undefined values and AQI from comparison
  const validComponents = {};
  for (const [key, value] of Object.entries(components)) {
    if (value !== null && value !== undefined && key !== 'aqi') {
      validComponents[key] = value;
    }
  }

  if (Object.keys(validComponents).length === 0) {
    return "unknown";
  }

  // Find component with highest value (simplified approach)
  const dominant = Object.keys(validComponents).reduce((a, b) => 
    validComponents[a] > validComponents[b] ? a : b
  );

  // Map to standard pollutant names
  const pollutantMap = {
    'pm2_5': 'PM2.5',
    'pm10': 'PM10',
    'co': 'CO',
    'nh3': 'NH3',
    'o3': 'O3',
    'no2': 'NO2'
  };

  return pollutantMap[dominant] || dominant;
}

/**
 * Process and aggregate the data
 * @param {Object[]} processedData - Array of processed data records
 * @param {Object} meteoData - Meteorological data object
 * @param {moment.Moment} targetHour - Target hour moment
 * @returns {Object} Aggregated data object
 */
export function processAndAggregate(processedData, meteoData, targetHour) {
  // Calculate averages for air quality components
  const averages = calculateAverages(processedData);

  // Get location data from the first processed record
  const locationData = processedData[0]?.location || {};
  const sensorId = processedData[0]?.id || '';

  // Determine dominant pollutant
  const dominantPollutant = determineDominantPollutant(averages);

  // Structure the aggregated data
  const aggregatedData = {
    aqi: averages.aqi,
    components: {
      co: averages.co,
      nh3: averages.nh3,
      no2: averages.no2,
      o3: averages.o3,
      pm10: averages.pm10,
      pm2_5: averages.pm2_5
    },
    dominant_pollutant: dominantPollutant,
    id: sensorId,
    location: {
      lat: locationData.lat,
      lon: locationData.lon,
      name: locationData.name
    },
    meteo: {
      log_prcp: meteoData?.main?.log_prcp || 0,
      rhum: meteoData?.main?.rhum || null,
      temp: meteoData?.main?.temp || null,
      wdir_cos: meteoData?.wind?.wdir_cos || null,
      wdir_sin: meteoData?.wind?.wdir_sin || null,
      wspd: meteoData?.wind?.wspd || null
    },
    timestamp: targetHour.toDate()
  };

  return aggregatedData;
}

/**
 * Create a standardized error response
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 * @returns {Object} Lambda response object
 */
export function createErrorResponse(statusCode, message, details = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      error: message,
      ...details
    })
  };
}

/**
 * Create a standardized success response
 * @param {Object} data - Response data
 * @returns {Object} Lambda response object
 */
export function createSuccessResponse(data) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  };
}
/**
 * Find the maximum AQI value in a dataset
 * @param {Array} data - Array of AQI data objects
 * @returns {Object} Object containing max AQI value and its timestamp
 */
function findMaxAQI(data) {
  if (!data || !data.length) {
    return { value: 0, timestamp: null };
  }
  
  const maxItem = data.reduce((max, item) => 
    item.aqi > max.aqi ? item : max, data[0]);
    
  return {
    value: maxItem.aqi,
    timestamp: maxItem.timestamp
  };
}

/**
 * Find the minimum AQI value in a dataset
 * @param {Array} data - Array of AQI data objects
 * @returns {Object} Object containing min AQI value and its timestamp
 */
function findMinAQI(data) {
  if (!data || !data.length) {
    return { value: 0, timestamp: null };
  }
  
  const minItem = data.reduce((min, item) => 
    item.aqi < min.aqi ? item : min, data[0]);
    
  return {
    value: minItem.aqi,
    timestamp: minItem.timestamp
  };
}

/**
 * Find the most common dominant pollutant in a dataset
 * @param {Array} data - Array of AQI data objects
 * @returns {Object} Object containing pollutant name and its frequency
 */
function findDominantPollutantMode(data) {
  if (!data || !data.length) {
    return { pollutant: null, frequency: 0 };
  }
  
  const pollutantCounts = data.reduce((counts, item) => {
    if (item.dominant_pollutant) {
      counts[item.dominant_pollutant] = (counts[item.dominant_pollutant] || 0) + 1;
    }
    return counts;
  }, {});
  
  // Find the pollutant with the highest count
  let maxPollutant = null;
  let maxCount = 0;
  
  for (const [pollutant, count] of Object.entries(pollutantCounts)) {
    if (count > maxCount) {
      maxPollutant = pollutant;
      maxCount = count;
    }
  }
  
  return {
    pollutant: maxPollutant,
    frequency: maxCount
  };
}

/**
 * Calculate average AQI for a dataset
 * @param {Array} data - Array of AQI data objects
 * @returns {number} Average AQI value
 */
function calculateAverageAQI(data) {
  if (!data || !data.length) {
    return 0;
  }
  
  const sum = data.reduce((total, item) => total + item.aqi, 0);
  return parseFloat((sum / data.length).toFixed(2));
}

module.exports = {
  findMaxAQI,
  findMinAQI,
  findDominantPollutantMode,
  calculateAverageAQI
};
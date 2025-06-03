const { config } = require('../config');
const { 
  getCurrentData: getFirebaseCurrentData, 
  getHistoricalData: getFirebaseHistoricalData, 
  getForecastData: getFirebaseForecastData 
} = require('../services/firebase');
const { getHealthRecommendations } = require('../utils/healthRecommendations');
const { pollutantInfo } = require('../utils/pollutantInfo');
const { 
  findMaxAQI, 
  findMinAQI, 
  findDominantPollutantMode,
  calculateAverageAQI
} = require('../utils/dataAnalysis');

/**
 * Get current air quality data for a location
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getCurrentData(req, res, next) {
  try {
    // Extract location from URL path
    const locationPath = req.path.split('/')[1];
    const location = decodeURIComponent(locationPath);
    
    // Get sensor ID for the location
    const sensorId = config.sensors.sensorIds[location];
    
    if (!sensorId) {
      return res.status(404).json({
        status: 'error',
        message: `Location not found: ${location}`
      });
    }
    
    // Get current data for the sensor
    const data = await getFirebaseCurrentData(sensorId);
    
    if (!data) {
      return res.status(404).json({
        status: 'error',
        message: `No data available for location: ${location}`
      });
    }
    
    // Get health recommendations based on AQI
    const healthRecommendations = getHealthRecommendations(data.aqi);
    
    // Get pollutant info if dominant pollutant is available
    let dominantPollutantInfo = null;
    if (data.dominant_pollutant) {
      dominantPollutantInfo = pollutantInfo[data.dominant_pollutant] || null;
    }
    
    // Prepare response
    const response = {
      location,
      timestamp: data.timestamp,
      aqi: data.aqi,
      components: data.components,
      dominant_pollutant: data.dominant_pollutant,
      dominantPollutantInfo,
      health: {
        riskLevel: healthRecommendations.riskLevel,
        generalMessage: healthRecommendations.generalMessage,
        vulnerableMessage: healthRecommendations.vulnerableMessage,
        recommendations: healthRecommendations.recommendations
      }
    };
    
    return res.json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Get historical air quality data for a location
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getHistoricalData(req, res, next) {
  try {
    // Extract location from URL path
    const pathParts = req.path.split('/');
    const locationPath = pathParts[1];
    const location = decodeURIComponent(locationPath);
    
    // Get sensor ID for the location
    const sensorId = config.sensors.sensorIds[location];
    
    if (!sensorId) {
      return res.status(404).json({
        status: 'error',
        message: `Location not found: ${location}`
      });
    }
    
    // Get time range from query parameter (default to 1 day)
    const timeRange = req.query.range || '1d';
    
    if (!config.timeRanges[timeRange]) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid time range: ${timeRange}. Valid values are: 1d, 7d, 30d`
      });
    }
    
    // Get historical data for the sensor
    const data = await getFirebaseHistoricalData(sensorId, timeRange);
    
    if (!data || data.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: `No historical data available for location: ${location}`
      });
    }
    
    // Analyze data
    const maxAQI = findMaxAQI(data);
    const minAQI = findMinAQI(data);
    const dominantPollutantMode = findDominantPollutantMode(data);
    const averageAQI = calculateAverageAQI(data);
    
    // Prepare response
    const response = {
      location,
      timeRange,
      readings: data,
      analysis: {
        maxAQI,
        minAQI,
        averageAQI,
        dominantPollutant: {
          name: dominantPollutantMode.pollutant,
          info: dominantPollutantMode.pollutant ? pollutantInfo[dominantPollutantMode.pollutant] : null,
          frequency: dominantPollutantMode.frequency
        }
      }
    };
    
    return res.json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Get forecast air quality data for a location
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getForecastData(req, res, next) {
  try {
    // Extract location from URL path
    const pathParts = req.path.split('/');
    const locationPath = pathParts[1];
    const location = decodeURIComponent(locationPath);
    
    // Get sensor ID for the location
    const sensorId = config.sensors.sensorIds[location];
    
    if (!sensorId) {
      return res.status(404).json({
        status: 'error',
        message: `Location not found: ${location}`
      });
    }
    
    // Get time range from query parameter (default to 1 day)
    const timeRange = req.query.range || '1d';
    
    if (!config.forecastRanges[timeRange]) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid time range: ${timeRange}. Valid values are: 1d, 3d`
      });
    }
    
    // Get forecast data for the sensor
    const data = await getFirebaseForecastData(sensorId, timeRange);
    
    if (!data || data.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: `No forecast data available for location: ${location}`
      });
    }
    
    // Get health recommendations based on average forecasted AQI
    const averageAQI = calculateAverageAQI(data);
    const healthRecommendations = getHealthRecommendations(averageAQI);
    
    // Prepare response
    const response = {
      location,
      timeRange,
      forecastReadings: data,
      averageForecastAQI: averageAQI,
      health: {
        riskLevel: healthRecommendations.riskLevel,
        generalMessage: healthRecommendations.generalMessage,
        vulnerableMessage: healthRecommendations.vulnerableMessage,
        recommendations: healthRecommendations.recommendations
      }
    };
    
    return res.json(response);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCurrentData,
  getHistoricalData,
  getForecastData
};
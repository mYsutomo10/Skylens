require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  environment: process.env.NODE_ENV || 'development',
  isDevelopment: (process.env.NODE_ENV || 'development') === 'development',
  
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKeyPath: process.env.FIREBASE_PRIVATE_KEY_PATH
  },
  
  gnews: {
    apiKey: process.env.GNEWS_API_KEY,
    apiUrl: process.env.GNEWS_API_URL,
    cacheTtl: parseInt(process.env.GNEWS_CACHE_TTL, 10) || 10800 // 3 hours in seconds
  },
  
  sensors: {
    sensorIds: {
      'Jalan Radio': 'sensor001',
      'Baleendah': 'sensor002'
    }
  },
  
  // Time ranges in milliseconds for history endpoints
  timeRanges: {
    '1d': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  }
};

// Reverse mapping for sensor IDs to locations
config.sensors.locationBySensorId = Object.entries(config.sensors.sensorIds)
  .reduce((acc, [location, id]) => {
    acc[id] = location;
    return acc;
  }, {});

module.exports = { config };
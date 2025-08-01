require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  environment: process.env.NODE_ENV || 'production',
  isDevelopment: (process.env.NODE_ENV || 'production') === 'development',

  gnews: {
    apiKey: process.env.GNEWS_API_KEY,
    apiUrl: process.env.GNEWS_API_URL,
    cacheTtl: parseInt(process.env.GNEWS_CACHE_TTL, 10) || 10800
  },

  sensors: {
    sensorIds: {
      'Jalan Radio': 'sensor001',
      'Baleendah': 'sensor002'
    }
  },

  timeRanges: {
    '5m': 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  }
};

config.sensors.locationBySensorId = Object.entries(config.sensors.sensorIds)
  .reduce((acc, [location, id]) => {
    acc[id] = location;
    return acc;
  }, {});

module.exports = { config };
const AWS = require('aws-sdk');
require('dotenv').config();

let cachedConfig = null;

async function loadConfig() {
  if (cachedConfig) return cachedConfig;

  let env = process.env;

  if (env.NODE_ENV !== 'development') {
    const region = env.AWS_REGION || 'ap-southeast-3';
    const secretName = env.AWS_SECRET_NAME;

    const client = new AWS.SecretsManager({ region });
    const data = await client.getSecretValue({ SecretId: secretName }).promise();
    env = JSON.parse(data.SecretString); // override env variable source
  }

  const config = {
    port: env.PORT || 3000,
    environment: env.NODE_ENV || 'development',
    isDevelopment: (env.NODE_ENV || 'development') === 'development',

    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    },

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
      '1d': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    },

    forecastRanges: {
      '1d': 24,
      '3d': 72
    }
  };

  config.sensors.locationBySensorId = Object.entries(config.sensors.sensorIds)
    .reduce((acc, [location, id]) => {
      acc[id] = location;
      return acc;
    }, {});

  cachedConfig = config;
  return config;
}

module.exports = { loadConfig };
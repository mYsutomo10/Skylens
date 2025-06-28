const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
require('dotenv').config();

let cachedConfig = null;

async function loadConfig() {
  if (cachedConfig) return cachedConfig;

  const secretName = 'skylens/backend/env';
  const client = new SecretsManagerClient({ region: 'ap-southeast-3' });

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);

    const secrets = JSON.parse(response.SecretString);

    const config = {
      port: secrets.PORT || 3000,
      environment: secrets.NODE_ENV || 'production',
      isDevelopment: (secrets.NODE_ENV || 'production') === 'development',

      firebase: {
        projectId: secrets.FIREBASE_PROJECT_ID,
        clientEmail: secrets.FIREBASE_CLIENT_EMAIL,
        privateKey: secrets.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      },

      gnews: {
        apiKey: secrets.GNEWS_API_KEY,
        apiUrl: secrets.GNEWS_API_URL,
        cacheTtl: parseInt(secrets.GNEWS_CACHE_TTL, 10) || 10800
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
      }
    };

    config.sensors.locationBySensorId = Object.entries(config.sensors.sensorIds)
      .reduce((acc, [location, id]) => {
        acc[id] = location;
        return acc;
      }, {});

    cachedConfig = config;
    return config;
  } catch (err) {
    console.error('Failed to load config from Secrets Manager:', err);
    throw err;
  }
}

module.exports = { loadConfig };
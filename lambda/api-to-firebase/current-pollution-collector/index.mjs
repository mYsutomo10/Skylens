import admin from 'firebase-admin';
import axios from 'axios';
import { DateTime } from 'luxon';
import { calculateAQI } from './utils.mjs';
import serviceAccount from './firebase-service-account.json' assert { type: 'json' };

// Inisialisasi Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Config
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const LOCATIONS = [
  { id: 'sensor001', name: "Jalan Radio", lat: -6.9731, lon: 107.6226 },
  { id: 'sensor002', name: "Baleendah", lat: -7.0026, lon: 107.6212 }
];

// Format timestamp ke "YYYYMMDDTHH" berdasarkan zona waktu Asia/Jakarta
function formatTimestampKey(date) {
  const dt = DateTime.fromJSDate(date, { zone: 'Asia/Jakarta' });
  const yyyy = dt.year;
  const mm = String(dt.month).padStart(2, '0');
  const dd = String(dt.day).padStart(2, '0');
  const hh = String(dt.hour).padStart(2, '0');
  const m = String(dt.minute).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${m}`;
}

// Fetch data OpenWeather Air Pollution Forecast
async function fetchPollutionForecast(lat, lon) {
  const url = `http://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`;
  const response = await axios.get(url);
  return response.data;
}

// Simpan data forecast beserta AQI ke Firestore
async function savePollutionDataToFirestore(sensorId, locationName, lat, lon, pollutionData) {
  const batch = db.batch();

  pollutionData.list.forEach((forecast) => {
    // Konversi waktu dari detik ke JS Date dengan zona waktu Asia/Jakarta
    const dt = DateTime.fromSeconds(forecast.dt, { zone: 'Asia/Jakarta' });
    const timestamp = dt.toJSDate();
    const docId = formatTimestampKey(timestamp);
    const components = forecast.components;

    const [aqi, dominant] = calculateAQI({
      pm2_5: components.pm2_5,
      pm10: components.pm10,
      o3: components.o3,
      co: components.co,
      no2: components.no2
    });

    const docRef = db
      .collection('current_data')
      .doc(sensorId)
      .collection('readings')
      .doc(docId);

    const data = {
      id: sensorId,
      location: {
        name: locationName,
        lat,
        lon
      },
      timestamp,
      aqi,
      dominant_pollutant: dominant,
      components: {
        co: components.co,
        no2: components.no2,
        o3: components.o3,
        pm2_5: components.pm2_5,
        pm10: components.pm10,
        nh3: components.nh3
      }
    };

    batch.set(docRef, data);
  });

  await batch.commit();
  console.log(`Saved ${pollutionData.list.length} entries for ${sensorId}`);
}

// Handler utama Lambda/API
export async function handler(event) {
  try {
    // Jika ada payload sensor (POST request dengan body)
    if (event.body) {
      const data = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

      if (!data.id || !data.datetime) {
        throw new Error('Missing required fields: id or datetime');
      }

      // Konversi waktu input ke zona Asia/Jakarta
      const dt = DateTime.fromISO(data.datetime, { zone: 'Asia/Jakarta' });
      const timestamp = dt.toJSDate();
      const docId = formatTimestampKey(timestamp);

      const [aqi, dominantPollutant] = calculateAQI({
        pm2_5: data.pm2_5,
        pm10: data.pm10,
        o3: data.o3,
        co: data.co,
        no2: data.no2
      });

      const ref = db
        .collection('current_data')
        .doc(data.id)
        .collection('readings')
        .doc(docId);

      await ref.set({
        id: data.id,
        name: data.name,
        location: { lat: data.lat, lon: data.lon },
        timestamp,
        components: {
          pm2_5: data.pm2_5,
          pm10: data.pm10,
          o3: data.o3,
          co: data.co,
          no2: data.no2,
          nh3: data.nh3
        },
        aqi,
        dominant_pollutant: dominantPollutant,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Sensor data stored successfully with AQI calculation.',
          aqi,
          dominant_pollutant: dominantPollutant
        })
      };
    }

    // Jika tidak ada body, fetch forecast untuk semua lokasi
    const results = await Promise.all(
      LOCATIONS.map(async (loc) => {
        const forecastData = await fetchPollutionForecast(loc.lat, loc.lon);
        await savePollutionDataToFirestore(loc.id, loc.name, loc.lat, loc.lon, forecastData);
        return {
          id: loc.id,
          location: loc.name,
          status: 'success',
          count: forecastData.list.length
        };
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        results,
        timestamp: new Date().toISOString()
      })
    };
  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to process request',
        message: err.message
      })
    };
  }
}
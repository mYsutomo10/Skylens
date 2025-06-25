import admin from 'firebase-admin';
import axios from 'axios';
import { DateTime } from 'luxon';
import { processWeatherData } from './utils.mjs';
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

// Fetch data OpenWeather Current Weather
async function fetchCurrentWeather(lat, lon) {
  const url = `http://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
  const response = await axios.get(url);
  return response.data;
}

// Simpan data weather ke Firestore
async function saveWeatherDataToFirestore(sensorId, locationName, lat, lon, weatherData) {
  // Konversi waktu dari detik ke JS Date dengan zona waktu Asia/Jakarta
  const dt = DateTime.fromSeconds(weatherData.dt, { zone: 'Asia/Jakarta' });
  const timestamp = dt.toJSDate();
  const docId = formatTimestampKey(timestamp);

  // Process weather data menggunakan utils
  const processedData = processWeatherData(weatherData);

  const docRef = db
    .collection('current_weather')
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
    main: {
      temp: processedData.temp,
      rhum: processedData.rhum,
      log_prcp: processedData.log_prcp
    },
    wind: {
      wdir_sin: processedData.wdir_sin,
      wdir_cos: processedData.wdir_cos,
      wspd: processedData.wspd
    },
    timestamp
  };

  await docRef.set(data);
  console.log(`Saved weather data for ${sensorId} at ${timestamp}`);
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

      // Process manual weather data
      const processedData = processWeatherData({
        main: {
          temp: data.temp,
          humidity: data.humidity,
          pressure: data.pressure
        },
        wind: {
          speed: data.wind_speed,
          deg: data.wind_deg
        },
        rain: data.rain ? { '1h': data.rain } : null,
        snow: data.snow ? { '1h': data.snow } : null
      });

      const ref = db
        .collection('current_weather')
        .doc(data.id)
        .collection('readings')
        .doc(docId);

      await ref.set({
        id: data.id,
        location: {
          name: data.name,
          lat: data.lat,
          lon: data.lon
        },
        main: {
          temp: processedData.temp,
          rhum: processedData.rhum,
          log_prcp: processedData.log_prcp
        },
        wind: {
          wdir_sin: processedData.wdir_sin,
          wdir_cos: processedData.wdir_cos,
          wspd: processedData.wspd
        },
        timestamp,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Weather data stored successfully.',
          processed_data: processedData
        })
      };
    }

    // Jika tidak ada body, fetch current weather untuk semua lokasi
    const results = await Promise.all(
      LOCATIONS.map(async (loc) => {
        const weatherData = await fetchCurrentWeather(loc.lat, loc.lon);
        await saveWeatherDataToFirestore(loc.id, loc.name, loc.lat, loc.lon, weatherData);
        return {
          id: loc.id,
          location: loc.name,
          status: 'success',
          timestamp: new Date(weatherData.dt * 1000).toISOString()
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
        error: 'Failed to process weather request',
        message: err.message
      })
    };
  }
}
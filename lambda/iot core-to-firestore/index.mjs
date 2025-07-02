import admin from 'firebase-admin';
import { DateTime } from 'luxon';
import { calculateAQI, reverseGeocode } from './utils.mjs';
import serviceAccount from './firebase-service-account.json' assert { type: 'json' };

// Inisialisasi Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// Format timestamp ke "YYYYMMDDTHHMM"
function formatTimestampKey(date) {
  const dt = DateTime.fromJSDate(date, { zone: 'Asia/Jakarta' });
  const yyyy = dt.year;
  const mm = String(dt.month).padStart(2, '0');
  const dd = String(dt.day).padStart(2, '0');
  const hh = String(dt.hour).padStart(2, '0');
  const m = String(dt.minute).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${m}`;
}

export async function handler(event) {
  try {
    let payload;
    if (event.body) {
      payload = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } else {
      payload = event;
    }

    // Validasi field penting
    if (!payload.id || payload.lat == null || payload.lon == null) {
      throw new Error('Missing required fields: id, lat, or lon');
    }

    const dt = DateTime.now().setZone('Asia/Jakarta');
    const timestamp = dt.toJSDate();
    const docId = formatTimestampKey(timestamp);

    // Hitung AQI dan polutan dominan
    const [aqi, dominantPollutant] = calculateAQI({
      pm2_5: payload.pm2_5,
      pm10: payload.pm10,
      o3: payload.o3,
      co: payload.co,
      no2: payload.no2
    });

    const locationName = await reverseGeocode(payload.lat, payload.lon);

    // Simpan ke Firestore
    const ref = db
      .collection('processed_data')
      .doc(payload.id)
      .collection('readings')
      .doc(docId);

    await ref.set({
      id: payload.id,
      location: { 
        lat: payload.lat, 
        lon: payload.lon, 
        name: locationName || payload.name },
      timestamp,
      components: {
        pm2_5: payload.pm2_5,
        pm10: payload.pm10,
        o3: payload.o3,
        co: payload.co,
        no2: payload.no2,
        nh3: payload.nh3
      },
      aqi,
      dominant_pollutant: dominantPollutant,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Data stored successfully with AQI and location caching.',
        aqi,
        dominant_pollutant: dominantPollutant,
        location_name: locationName
      })
    };
  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to process IoT payload',
        message: err.message
      })
    };
  }
}
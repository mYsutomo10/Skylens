import admin from 'firebase-admin';
import { DateTime } from 'luxon';
import { calculateAQI } from './utils.mjs';
import serviceAccount from './firebase-service-account.json' assert { type: 'json' };

// Inisialisasi Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Format timestamp ke "YYYYMMDDTHHMM" berdasarkan zona waktu Asia/Jakarta
function formatTimestampKey(date) {
  const dt = DateTime.fromJSDate(date, { zone: 'Asia/Jakarta' });
  const yyyy = dt.year;
  const mm = String(dt.month).padStart(2, '0');
  const dd = String(dt.day).padStart(2, '0');
  const hh = String(dt.hour).padStart(2, '0');
  const m = String(dt.minute).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${m}`;
}

// Handler utama menerima event dari IoT Core
export async function handler(event) {
  try {
    const payload = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    if (!payload.id || !payload.name) {
      throw new Error('Missing required fields: id or name');
    }

    // Gunakan waktu saat ini (waktu kedatangan data) sebagai timestamp
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

    const ref = db
      .collection('current_data')
      .doc(payload.id)
      .collection('readings')
      .doc(docId);

    // Simpan ke Firestore
    await ref.set({
      id: payload.id,
      name: locationName || payload.name,
      location: { lat: payload.lat, lon: payload.lon },
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
        message: 'IoT data stored successfully with AQI calculation.',
        aqi,
        dominant_pollutant: dominantPollutant
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
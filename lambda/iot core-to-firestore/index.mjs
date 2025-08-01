import admin from 'firebase-admin';
import { DateTime } from 'luxon';
import { ppmToMicrogramPerCubicMeter, ppbToMicrogramPerCubicMeter } from './utils.mjs';
import serviceAccount from './firebase-service-account.json' assert { type: 'json' };

// Firebase Admin Initialization
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// Function to round 5 decimals
function round5(value) {
  return typeof value === 'number' ? Math.round(value * 100000) / 100000 : null;
}

// Format timestamp to “YYYYMMDDTHHMM”
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

    if (!payload.id) {
      throw new Error('Missing required fields: id');
    }

    const dt = DateTime.now().setZone('Asia/Jakarta');
    const timestamp = dt.toJSDate();
    const docId = formatTimestampKey(timestamp);

    // Simpan ke Firestore
    const ref = db
      .collection('processed_data')
      .doc(payload.id)
      .collection('readings')
      .doc(docId);

    await ref.set({
      id: payload.id,
      location: { 
        name: payload.name || null
      },
      timestamp,
      components: {
        pm2_5: round5(payload.pm2_5),
        pm10: round5(payload.pm10),
        o3: round5(ppbToMicrogramPerCubicMeter(payload.o3, 'o3')),
        co: round5(ppmToMicrogramPerCubicMeter(payload.co, 'co')),
        no2: round5(ppmToMicrogramPerCubicMeter(payload.no2, 'no2')),
        nh3: round5(ppmToMicrogramPerCubicMeter(payload.nh3, 'nh3'))
      },
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Data stored successfully.'
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
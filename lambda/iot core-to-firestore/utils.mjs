import fetch from 'node-fetch';

const AQI_BREAKPOINTS = {
    pm2_5: [
      [0.0, 12.0, 0, 50],
      [12.1, 35.4, 51, 100],
      [35.5, 55.4, 101, 150],
      [55.5, 150.4, 151, 200],
      [150.5, 250.4, 201, 300],
      [250.5, 350.4, 301, 400],
      [350.5, 500.4, 401, 500]
    ],
    pm10: [
      [0, 54, 0, 50],
      [55, 154, 51, 100],
      [155, 254, 101, 150],
      [255, 354, 151, 200],
      [355, 424, 201, 300],
      [425, 504, 301, 400],
      [505, 604, 401, 500]
    ],
    o3: [
      [0, 54, 0, 50],
      [55, 70, 51, 100],
      [71, 85, 101, 150],
      [86, 105, 151, 200],
      [106, 200, 201, 300]
    ],
    co: [
      [0.0, 4.4, 0, 50],
      [4.5, 9.4, 51, 100],
      [9.5, 12.4, 101, 150],
      [12.5, 15.4, 151, 200],
      [15.5, 30.4, 201, 300]
    ],
    no2: [
      [0, 53, 0, 50],
      [54, 100, 51, 100],
      [101, 360, 101, 150],
      [361, 649, 151, 200]
    ]
  };
  
  export function computeIndividualAQI(pollutant, concentration) {
    const breakpoints = AQI_BREAKPOINTS[pollutant];
    if (!breakpoints) return null;
  
    for (const [Clow, Chigh, Ilow, Ihigh] of breakpoints) {
      if (concentration >= Clow && concentration <= Chigh) {
        const aqi = ((Ihigh - Ilow) / (Chigh - Clow)) * (concentration - Clow) + Ilow;
        return Math.round(aqi);
      }
    }
    return null;
  }
  
  export function calculateAQI(data) {
    const pollutants = ["pm2_5", "pm10", "o3", "co", "no2"];
    const aqiValues = {};
  
    for (const pollutant of pollutants) {
      const value = data[pollutant];
      if (value !== undefined && value !== null) {
        const aqi = computeIndividualAQI(pollutant, value);
        if (aqi !== null) {
          aqiValues[pollutant] = aqi;
        }
      }
    }
  
    const entries = Object.entries(aqiValues);
    if (entries.length === 0) return [null, null];
  
    let dominantPollutant = entries[0][0];
    let maxAQI = entries[0][1];
  
    for (const [pollutant, aqi] of entries) {
      if (aqi > maxAQI) {
        maxAQI = aqi;
        dominantPollutant = pollutant;
      }
    }
  
    return [maxAQI, dominantPollutant];
  }

  const locationCache = new Map();

export async function reverseGeocode(lat, lon) {
  const roundedKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (locationCache.has(roundedKey)) {
    return locationCache.get(roundedKey);
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'SensorAQILambda/1.0 (yogasutomo67@gmail.com)'
    }
  });

  if (!res.ok) throw new Error(`Reverse geocoding failed: ${res.statusText}`);

  const data = await res.json();
  const addr = data.address || {};

  // Ambil komponen singkat
  const parts = [
    addr.village || addr.suburb,
    addr.county,
    addr.city || addr.town || addr.municipality || addr.state_district
  ].filter(Boolean);

  const name = parts.join(', ') || 'Unknown location';

  locationCache.set(roundedKey, name);
  return name;
}
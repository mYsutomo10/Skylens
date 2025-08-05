//utils.mjs
import moment from 'moment-timezone';

export function parseTimestamp(timestampStr) {
  try {
    if (!/^\d{8}T\d{4}$/.test(timestampStr)) {
      throw new Error(`Invalid timestamp format: ${timestampStr}. Expected format: YYYYMMDDTHHMM`);
    }

    const year = parseInt(timestampStr.substring(0, 4));
    const month = parseInt(timestampStr.substring(4, 6)) - 1;
    const day = parseInt(timestampStr.substring(6, 8));
    const hour = parseInt(timestampStr.substring(9, 11));
    const minute = parseInt(timestampStr.substring(11, 13));

    const dt = moment.tz([year, month, day, hour, minute], "Asia/Jakarta");

    if (!dt.isValid()) {
      throw new Error(`Invalid timestamp values: ${timestampStr}`);
    }

    return dt;
  } catch (error) {
    throw new Error(`Invalid timestamp format: ${timestampStr}. Expected format: YYYYMMDDTHHMM`);
  }
}

export function generateCurrentHourTimestamp() {
  const now = moment.tz("Asia/Jakarta");
  const targetHour = now.clone().startOf('hour');
  const { hourStart, hourEnd } = getHourRange(targetHour);
  const timestampStr = targetHour.format('YYYYMMDDTHHMM');

  return {
    targetHour,
    hourStart,
    hourEnd,
    timestampStr
  };
}

export function getHourRange(targetHour) {
  const hourStart = targetHour.clone().startOf('hour');
  const hourEnd = targetHour.clone().endOf('hour');
  return { hourStart, hourEnd };
}

export function removeOutliers(values, method = 'iqr') {
  if (values.length < 4) return values;
  if (method === 'iqr') {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    return values.filter(v => v >= lower && v <= upper);
  }
  return values;
}

export function calculateAverages(processedData) {
  console.log('calculateAverages - Input data:', JSON.stringify(processedData, null, 2));
  
  // Inisialisasi array untuk setiap komponen
  const components = {
    pm2_5: [],
    pm10: [],
    co: [],
    nh3: [],
    o3: [],
    no2: []
  };

  // Ekstrak nilai dari processedData dan masukkan ke dalam array
  processedData.forEach((data, index) => {
    console.log(`Processing data record ${index}:`, JSON.stringify(data, null, 2));
    
    // Cek berbagai kemungkinan struktur data
    if (data.components) {
      // Struktur: { components: { pm2_5: value, pm10: value, ... } }
      console.log('Found components object:', JSON.stringify(data.components, null, 2));
      Object.keys(components).forEach(key => {
        const value = data.components[key];
        if (value !== null && value !== undefined && typeof value === 'number') {
          components[key].push(value);
          console.log(`Added ${key}: ${value}`);
        }
      });
    } else if (data.main) {
      // Struktur: { main: { pm2_5: value, pm10: value, ... } }
      console.log('Found main object:', JSON.stringify(data.main, null, 2));
      Object.keys(components).forEach(key => {
        const value = data.main[key];
        if (value !== null && value !== undefined && typeof value === 'number') {
          components[key].push(value);
          console.log(`Added ${key}: ${value}`);
        }
      });
    } else {
      // Struktur langsung: { pm2_5: value, pm10: value, ... }
      console.log('Using direct structure');
      Object.keys(components).forEach(key => {
        const value = data[key];
        if (value !== null && value !== undefined && typeof value === 'number') {
          components[key].push(value);
          console.log(`Added ${key}: ${value}`);
        }
      });
    }
  });

  console.log('Components arrays after processing:', JSON.stringify(components, null, 2));

  // Hitung rata-rata untuk setiap komponen
  const averages = {};
  for (const [key, values] of Object.entries(components)) {
    console.log(`Processing component ${key} with ${values.length} values:`, values);
    
    if (values.length > 0) {
      // Hapus outliers jika ada cukup data
      const clean = removeOutliers(values);
      const used = clean.length > 0 ? clean : values;
      
      const sum = used.reduce((sum, v) => sum + v, 0);
      const average = sum / used.length;
      averages[key] = Math.round(average * 10) / 10;
      
      console.log(`${key}: ${values.length} values -> ${clean.length} after outlier removal -> average: ${averages[key]}`);
    } else {
      averages[key] = null;
      console.log(`${key}: No values found, setting to null`);
    }
  }

  console.log('Final averages:', JSON.stringify(averages, null, 2));
  return averages;
}

const ISPU_BREAKPOINTS = {
  pm10: [
    { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
    { cLow: 51, cHigh: 150, iLow: 51, iHigh: 100 },
    { cLow: 151, cHigh: 350, iLow: 101, iHigh: 200 },
    { cLow: 351, cHigh: 420, iLow: 201, iHigh: 300 },
    { cLow: 421, cHigh: 500, iLow: 301, iHigh: 500 }
  ],
  pm2_5: [
    { cLow: 0, cHigh: 15.5, iLow: 0, iHigh: 50 },
    { cLow: 15.6, cHigh: 55.4, iLow: 51, iHigh: 100 },
    { cLow: 55.5, cHigh: 150.4, iLow: 101, iHigh: 200 },
    { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
    { cLow: 250.5, cHigh: 500, iLow: 301, iHigh: 500 }
  ],
  co: [
    { cLow: 0, cHigh: 4000, iLow: 0, iHigh: 50 },
    { cLow: 4001, cHigh: 8000, iLow: 51, iHigh: 100 },
    { cLow: 8001, cHigh: 15000, iLow: 101, iHigh: 200 },
    { cLow: 15001, cHigh: 30000, iLow: 201, iHigh: 300 },
    { cLow: 30001, cHigh: 45000, iLow: 301, iHigh: 500 }
  ],
  o3: [
    { cLow: 0, cHigh: 120, iLow: 0, iHigh: 50 },
    { cLow: 121, cHigh: 235, iLow: 51, iHigh: 100 },
    { cLow: 236, cHigh: 400, iLow: 101, iHigh: 200 },
    { cLow: 401, cHigh: 800, iLow: 201, iHigh: 300 },
    { cLow: 801, cHigh: 1000, iLow: 301, iHigh: 500 }
  ],
  no2: [
    { cLow: 0, cHigh: 80, iLow: 0, iHigh: 50 },
    { cLow: 81, cHigh: 200, iLow: 51, iHigh: 100 },
    { cLow: 201, cHigh: 1130, iLow: 101, iHigh: 200 },
    { cLow: 1131, cHigh: 2260, iLow: 201, iHigh: 300 },
    { cLow: 2261, cHigh: 3000, iLow: 301, iHigh: 500 }
  ]
};

export function calculateISPU(component, concentration) {
  console.log(`Calculating ISPU for ${component} with concentration: ${concentration}`);
  
  const breakpoints = ISPU_BREAKPOINTS[component];
  if (!breakpoints || concentration == null) {
    console.log(`No breakpoints found for ${component} or concentration is null`);
    return null;
  }

  for (const bp of breakpoints) {
    if (concentration >= bp.cLow && concentration <= bp.cHigh) {
      const ispu = Math.round(
        ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (concentration - bp.cLow) + bp.iLow
      );
      console.log(`ISPU for ${component}: ${ispu}`);
      return ispu;
    }
  }
  
  console.log(`Concentration ${concentration} for ${component} is outside all breakpoint ranges`);
  return null;
}

export function processAndAggregate(processedData, meteoData, targetHour) {
  console.log('processAndAggregate - Input processedData:', JSON.stringify(processedData, null, 2));
  console.log('processAndAggregate - Input meteoData:', JSON.stringify(meteoData, null, 2));
  
  const averages = calculateAverages(processedData);
  console.log('processAndAggregate - Calculated averages:', JSON.stringify(averages, null, 2));

  const ispuComponents = {};
  for (const [key, value] of Object.entries(averages)) {
    if (['pm2_5', 'pm10', 'co', 'no2', 'o3'].includes(key)) {
      ispuComponents[key] = calculateISPU(key, value);
    }
  }
  console.log('processAndAggregate - ISPU components:', JSON.stringify(ispuComponents, null, 2));

  let aqi = null;
  let dominantPollutant = 'unknown';
  const valid = Object.entries(ispuComponents).filter(([_, v]) => v !== null);
  if (valid.length > 0) {
    valid.sort((a, b) => b[1] - a[1]);
    [dominantPollutant, aqi] = valid[0];
  }
  console.log(`processAndAggregate - AQI: ${aqi}, Dominant pollutant: ${dominantPollutant}`);

  const locationData = processedData[0]?.location || {};
  const sensorId = processedData[0]?.id || '';

  const result = {
    aqi,
    components: {
      co: averages.co,
      nh3: averages.nh3,
      no2: averages.no2,
      o3: averages.o3,
      pm10: averages.pm10,
      pm2_5: averages.pm2_5
    },
    dominant_pollutant: dominantPollutant.toUpperCase(),
    id: sensorId,
    location: { name: locationData.name },
    meteo: {
      log_prcp: meteoData?.main?.log_prcp || 0,
      rhum: meteoData?.main?.rhum || null,
      temp: meteoData?.main?.temp || null,
      wdir_cos: meteoData?.wind?.wdir_cos || null,
      wdir_sin: meteoData?.wind?.wdir_sin || null,
      wspd: meteoData?.wind?.wspd || null
    },
    timestamp: targetHour.toDate()
  };

  console.log('processAndAggregate - Final result:', JSON.stringify(result, null, 2));
  return result;
}

export function createErrorResponse(statusCode, message, details = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message, ...details })
  };
}

export function createSuccessResponse(data) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };
}
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

/**
 * @param {string} pollutant
 * @param {number} concentration
 * @returns {number|null}
 */
export function calculateISPU(pollutant, concentration) {
  const breakpoints = ISPU_BREAKPOINTS[pollutant];
  if (!breakpoints || typeof concentration !== 'number') return null;

  for (const range of breakpoints) {
    if (concentration >= range.cLow && concentration <= range.cHigh) {
      const { cLow, cHigh, iLow, iHigh } = range;
      return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (concentration - cLow) + iLow);
    }
  }
  return null;
}

// Molar volume constant at 25°C and 1 atm
const MOLAR_VOLUME = 24.45; // liter/mol

// Molar mass for each gas (gram/mol)
const MOLAR_MASSES = {
  co: 28.01,
  o3: 48.00,
  nh3: 17.03,
  no2: 46.01
};

/**
 * Convert ppm to µg/m³
 * @param {number} ppm - concentration in ppm
 * @param {string} gas - gas key: 'co', 'o3', 'nh3', 'no2'
 * @returns {number|null}
 */
export function ppmToMicrogramPerCubicMeter(ppm, gas) {
  const molarMass = MOLAR_MASSES[gas];
  if (!molarMass || typeof ppm !== 'number') return null;

  return ppm * (molarMass * 1000) / MOLAR_VOLUME;
}

/**
 * Convert ppb to µg/m³
 * @param {number} ppb - concentration in ppb
 * @param {string} gas - gas key: 'co', 'o3', 'nh3', 'no2'
 * @returns {number|null}
 */
export function ppbToMicrogramPerCubicMeter(ppb, gas) {
  const molarMass = MOLAR_MASSES[gas];
  if (!molarMass || typeof ppb !== 'number') return null;

  return (ppb / 1000) * (molarMass * 1000) / MOLAR_VOLUME;
}
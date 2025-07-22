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

  // since 1 ppm = 1000 ppb, divide ppb by 1000 to get ppm
  const ppm = ppb / 1000;

  return ppm * (molarMass * 1000) / MOLAR_VOLUME;
}
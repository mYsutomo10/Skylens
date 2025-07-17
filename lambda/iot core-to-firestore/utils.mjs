// Molar volume constant at 25°C and 1 atm
const MOLAR_VOLUME = 24.45; // liter/mol

// Molar mass for each gas (gram/mol)
const MOLAR_MASSES = {
  co: 28.01,
  o3: 48.00,
  nh3: 17.03,
  no2: 46.01
};

export function ppmToMicrogramPerCubicMeter(ppm, gas) {
  const molarMass = MOLAR_MASSES[gas];
  if (!molarMass || typeof ppm !== 'number') return null;

  return ppm * (molarMass * 1000) / MOLAR_VOLUME;
}
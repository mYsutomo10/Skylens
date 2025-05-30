/**
 * Calculate cigarette equivalent based on AQI
 * @param {number} aqi - Air Quality Index value
 * @param {number} years - Number of years of exposure
 * @returns {number} Equivalent cigarettes per day
 */
function calculateCigaretteEquivalent(aqi, years = 1) {
  // A rough approximation based on research showing that an AQI of 22 for one year
  // is equivalent to smoking 1 cigarette per day
  const cigarettesPerDay = (aqi / 22) * 1;
  return parseFloat((cigarettesPerDay * years).toFixed(2));
}

/**
 * Calculate asthma risk increase based on NO2 levels
 * @param {number} no2Level - NO2 level in μg/m³
 * @returns {number} Percentage increase in asthma risk
 */
function calculateAsthmaRiskIncrease(no2Level) {
  // Based on research showing approximately 4% increased risk of asthma per 10 μg/m³ increase in NO2
  const baselineNo2 = 10; // μg/m³, considered relatively clean
  const riskIncrease = ((no2Level - baselineNo2) / 10) * 4;
  return Math.max(0, parseFloat(riskIncrease.toFixed(2)));
}

/**
 * Get pollution impact simulations based on pollutant levels
 * @param {Object} data - Air quality data
 * @returns {Array} Array of impact simulations
 */
function getPollutionImpactSimulations(data) {
  const { aqi, components } = data;
  
  const simulations = [];
  
  // Cigarette equivalent simulation
  simulations.push({
    title: 'Cigarette Equivalent',
    description: `Living in an area with an AQI of ${aqi} for 1 year is equivalent to smoking ${calculateCigaretteEquivalent(aqi, 1)} cigarettes per day.`,
    detail: `For 10 years, it would be equivalent to smoking ${calculateCigaretteEquivalent(aqi, 10)} cigarettes per day.`
  });
  
  // Asthma risk simulation (if NO2 data is available)
  if (components && components.no2) {
    const no2Level = components.no2;
    const riskIncrease = calculateAsthmaRiskIncrease(no2Level);
    
    simulations.push({
      title: 'Asthma Risk',
      description: `Exposure to the current NO₂ level (${no2Level} μg/m³) for 1 year increases the risk of developing asthma by approximately ${riskIncrease}%.`,
      detail: 'Children and the elderly are particularly vulnerable to these effects.'
    });
  }
  
  // Lung function simulation
  if (components && components.pm2_5) {
    const pm25Level = components.pm2_5;
    // Simplified approximation based on studies
    const lungFunctionDecrease = (pm25Level / 10) * 1.5; // ~1.5% decrease per 10 μg/m³ of PM2.5
    
    simulations.push({
      title: 'Lung Function',
      description: `Long-term exposure to the current PM2.5 level (${pm25Level} μg/m³) may decrease lung function by approximately ${lungFunctionDecrease.toFixed(1)}%.`,
      detail: 'This effect is cumulative over years of exposure.'
    });
  }
  
  // Life expectancy simulation
  simulations.push({
    title: 'Life Expectancy',
    description: `Living in an area with an AQI of ${aqi} may reduce life expectancy by approximately ${(aqi / 100).toFixed(1)} years over a lifetime.`,
    detail: 'This is an approximation based on epidemiological studies linking air pollution to mortality.'
  });
  
  return simulations;
}

module.exports = {
  calculateCigaretteEquivalent,
  calculateAsthmaRiskIncrease,
  getPollutionImpactSimulations
};
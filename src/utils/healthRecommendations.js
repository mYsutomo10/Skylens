/**
 * Get health recommendations based on AQI value
 * @param {number} aqi - Air Quality Index value
 * @returns {Object} Health recommendations and risk level
 */
function getHealthRecommendations(aqi) {
  let riskLevel, generalMessage, vulnerableMessage, recommendations;

  if (aqi <= 50) {
    riskLevel = 'Good';
    generalMessage = 'Air quality is satisfactory, and air pollution poses little or no risk.';
    vulnerableMessage = 'No precautions needed.';
    recommendations = [
      'Enjoy outdoor activities',
      'Keep windows open for fresh air',
      'Perfect time for outdoor exercise'
    ];
  } else if (aqi <= 100) {
    riskLevel = 'Moderate';
    generalMessage = 'Air quality is acceptable for most individuals.';
    vulnerableMessage = 'Unusually sensitive people should consider reducing prolonged or heavy exertion.';
    recommendations = [
      'Sensitive individuals should consider reducing prolonged outdoor activities',
      'Monitor your health for any respiratory symptoms',
      'Keep medication handy if you have asthma or other respiratory conditions'
    ];
  } else if (aqi <= 150) {
    riskLevel = 'Unhealthy for Sensitive Groups';
    generalMessage = 'Members of sensitive groups may experience health effects.';
    vulnerableMessage = 'Active children and adults, and people with respiratory disease, such as asthma, should limit prolonged outdoor exertion.';
    recommendations = [
      'Sensitive groups should reduce outdoor activities',
      'Keep windows closed during peak pollution hours',
      'Use air purifiers indoors if available',
      'Stay hydrated',
      'Monitor air quality forecasts'
    ];
  } else if (aqi <= 200) {
    riskLevel = 'Unhealthy';
    generalMessage = 'Everyone may begin to experience health effects.';
    vulnerableMessage = 'Active children and adults, and people with respiratory disease, such as asthma, should avoid prolonged outdoor exertion; everyone else should limit prolonged outdoor exertion.';
    recommendations = [
      'Avoid prolonged outdoor activities',
      'Wear an N95 mask when outdoors',
      'Keep windows closed',
      'Use air purifiers indoors',
      'Stay hydrated',
      'Avoid exercising near high-traffic areas'
    ];
  } else if (aqi <= 300) {
    riskLevel = 'Very Unhealthy';
    generalMessage = 'Health warnings of emergency conditions. The entire population is more likely to be affected.';
    vulnerableMessage = 'Active children and adults, and people with respiratory disease, such as asthma, should avoid all outdoor exertion; everyone else should limit outdoor exertion.';
    recommendations = [
      'Stay indoors as much as possible',
      'Keep all windows and doors closed',
      'Use air purifiers with HEPA filters',
      'Wear N95 masks when outdoors',
      'Avoid all outdoor physical activities',
      'Consider relocating temporarily if possible',
      'Check on elderly neighbors and those with respiratory conditions'
    ];
  } else {
    riskLevel = 'Hazardous';
    generalMessage = 'Health alert: everyone may experience more serious health effects.';
    vulnerableMessage = 'Everyone should avoid all outdoor exertion.';
    recommendations = [
      'Stay indoors at all times',
      'Create a clean air room with air purifiers',
      'Seal doors and windows if possible',
      'Wear N95 masks if you must go outside',
      'Avoid all physical exertion',
      'Seek medical help if experiencing respiratory symptoms',
      'Follow evacuation orders if issued by authorities'
    ];
  }

  return {
    riskLevel,
    generalMessage,
    vulnerableMessage,
    recommendations
  };
}

module.exports = {
  getHealthRecommendations
};
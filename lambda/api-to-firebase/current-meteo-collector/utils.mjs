/**
 * Process weather data from OpenWeather API
 * Converts to required format: temp, rhum, log_prcp, wdir_sin, wdir_cos, wspd
 * @param {Object} weatherData - Raw weather data from OpenWeather API
 * @returns {Object} Processed weather data
 */
export function processWeatherData(weatherData) {
  const result = {
    temp: 0,
    rhum: 0,
    log_prcp: 0,
    wdir_sin: 0,
    wdir_cos: 0,
    wspd: 0
  };

  // Temperature (already in Celsius from API with units=metric)
  if (weatherData.main && weatherData.main.temp !== undefined) {
    result.temp = parseFloat(weatherData.main.temp.toFixed(2));
  }

  // Relative Humidity (percentage)
  if (weatherData.main && weatherData.main.humidity !== undefined) {
    result.rhum = parseFloat(weatherData.main.humidity.toFixed(2));
  }

  // Precipitation (log transform)
  let precipitation = 0;
  
  // Check for rain data
  if (weatherData.rain) {
    if (weatherData.rain['1h']) {
      precipitation += weatherData.rain['1h'];
    } else if (weatherData.rain['3h']) {
      precipitation += weatherData.rain['3h'] / 3; // Convert 3h to 1h average
    }
  }
  
  // Check for snow data
  if (weatherData.snow) {
    if (weatherData.snow['1h']) {
      precipitation += weatherData.snow['1h'];
    } else if (weatherData.snow['3h']) {
      precipitation += weatherData.snow['3h'] / 3; // Convert 3h to 1h average
    }
  }
  
  // Log transform: log(precipitation + 1) to handle zero values
  result.log_prcp = parseFloat(Math.log(precipitation + 1).toFixed(4));

  // Wind direction and speed
  if (weatherData.wind) {
    // Wind speed (m/s)
    if (weatherData.wind.speed !== undefined) {
      result.wspd = parseFloat(weatherData.wind.speed.toFixed(2));
    }

    // Wind direction (convert degrees to sin/cos components)
    if (weatherData.wind.deg !== undefined) {
      const windDegRadians = (weatherData.wind.deg * Math.PI) / 180;
      result.wdir_sin = parseFloat(Math.sin(windDegRadians).toFixed(4));
      result.wdir_cos = parseFloat(Math.cos(windDegRadians).toFixed(4));
    }
  }

  return result;
}

/**
 * Convert temperature from Kelvin to Celsius
 * @param {number} kelvin - Temperature in Kelvin
 * @returns {number} Temperature in Celsius
 */
export function kelvinToCelsius(kelvin) {
  return kelvin - 273.15;
}

/**
 * Convert wind speed from different units to m/s
 * @param {number} speed - Wind speed
 * @param {string} unit - Current unit ('ms', 'kmh', 'mph', 'kts')
 * @returns {number} Wind speed in m/s
 */
export function convertWindSpeed(speed, unit = 'ms') {
  switch (unit.toLowerCase()) {
    case 'kmh':
    case 'km/h':
      return speed / 3.6;
    case 'mph':
      return speed * 0.44704;
    case 'kts':
    case 'knots':
      return speed * 0.514444;
    case 'ms':
    case 'm/s':
    default:
      return speed;
  }
}

/**
 * Validate weather data completeness
 * @param {Object} data - Processed weather data
 * @returns {Object} Validation result
 */
export function validateWeatherData(data) {
  const required = ['temp', 'rhum', 'log_prcp', 'wdir_sin', 'wdir_cos', 'wspd'];
  const missing = required.filter(field => data[field] === undefined || data[field] === null);
  
  return {
    isValid: missing.length === 0,
    missingFields: missing,
    data
  };
}

/**
 * Calculate dew point from temperature and humidity
 * @param {number} temp - Temperature in Celsius
 * @param {number} humidity - Relative humidity in percentage
 * @returns {number} Dew point in Celsius
 */
export function calculateDewPoint(temp, humidity) {
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * temp) / (b + temp)) + Math.log(humidity / 100);
  return (b * alpha) / (a - alpha);
}

/**
 * Calculate heat index from temperature and humidity
 * @param {number} temp - Temperature in Celsius
 * @param {number} humidity - Relative humidity in percentage
 * @returns {number} Heat index in Celsius
 */
export function calculateHeatIndex(temp, humidity) {
  // Convert to Fahrenheit for calculation
  const tempF = (temp * 9/5) + 32;
  
  if (tempF < 80) {
    return temp; // No heat index calculation needed below 80°F
  }
  
  const c1 = -42.379;
  const c2 = 2.04901523;
  const c3 = 10.14333127;
  const c4 = -0.22475541;
  const c5 = -0.00683783;
  const c6 = -0.05481717;
  const c7 = 0.00122874;
  const c8 = 0.00085282;
  const c9 = -0.00000199;
  
  const hiF = c1 + (c2 * tempF) + (c3 * humidity) + (c4 * tempF * humidity) +
             (c5 * tempF * tempF) + (c6 * humidity * humidity) +
             (c7 * tempF * tempF * humidity) + (c8 * tempF * humidity * humidity) +
             (c9 * tempF * tempF * humidity * humidity);
  
  // Convert back to Celsius
  return (hiF - 32) * 5/9;
}
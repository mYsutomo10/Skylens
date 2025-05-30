/**
 * Information about different pollutants
 */
const pollutantInfo = {
  pm2_5: {
    name: 'PM2.5',
    explanation: 'Fine particulate matter with a diameter of 2.5 micrometers or less. These particles are small enough to penetrate deep into the lungs and even enter the bloodstream.',
    sources: 'Vehicle emissions, power plants, industrial processes, wildfires, agricultural burning, and residential wood burning.',
    safeLimit: '12 µg/m³ (annual average), 35 µg/m³ (24-hour average)',
    healthEffects: 'Respiratory and cardiovascular issues, aggravated asthma, decreased lung function, irregular heartbeat, and premature death in people with heart or lung disease.'
  },
  pm10: {
    name: 'PM10',
    explanation: 'Inhalable particles with a diameter of 10 micrometers or less. These particles can enter the lungs but are filtered by the respiratory system more effectively than PM2.5.',
    sources: 'Dust from roads and construction sites, agricultural operations, industrial processes, and wildfires.',
    safeLimit: '50 µg/m³ (24-hour average), 20 µg/m³ (annual average)',
    healthEffects: 'Irritation of the eyes, nose, and throat, coughing, chest tightness, shortness of breath, and aggravated asthma.'
  },
  o3: {
    name: 'Ozone (O₃)',
    explanation: 'A gas formed when pollutants from vehicles, power plants, and other sources react chemically in the presence of sunlight. Ground-level ozone is a key component of smog.',
    sources: 'Not directly emitted but formed from reactions between nitrogen oxides (NOx) and volatile organic compounds (VOCs) in the presence of sunlight.',
    safeLimit: '70 ppb (8-hour average)',
    healthEffects: 'Chest pain, coughing, throat irritation, inflammation of the airways, reduced lung function, and worsened asthma and other chronic lung diseases.'
  },
  no2: {
    name: 'Nitrogen Dioxide (NO₂)',
    explanation: 'A reddish-brown gas with a pungent odor, part of a group of gases called nitrogen oxides (NOx).',
    sources: 'Vehicle emissions, power plants, industrial processes, and indoor gas stoves and heaters.',
    safeLimit: '100 µg/m³ (1-hour average), 40 µg/m³ (annual average)',
    healthEffects: 'Irritation of the respiratory system, aggravated asthma, increased susceptibility to respiratory infections, and long-term exposure can lead to chronic lung disease.'
  },
  co: {
    name: 'Carbon Monoxide (CO)',
    explanation: 'A colorless, odorless gas that forms when carbon in fuel doesn\'t burn completely.',
    sources: 'Vehicle exhaust, industrial processes, residential wood burning, and cigarette smoke.',
    safeLimit: '9 ppm (8-hour average), 35 ppm (1-hour average)',
    healthEffects: 'Reduces oxygen delivery to the body\'s organs, headaches, dizziness, and at high levels, it can cause unconsciousness and death.'
  },
  nh3: {
    name: 'Ammonia (NH₃)',
    explanation: 'A colorless gas with a strong, pungent odor.',
    sources: 'Agricultural activities, livestock waste, fertilizer application, and industrial processes.',
    safeLimit: '100 µg/m³ (annual average)',
    healthEffects: 'Irritation of the eyes, nose, and throat, respiratory issues, and can contribute to the formation of secondary particulate matter.'
  }
};

module.exports = {
  pollutantInfo
};
/**
 * Array of daily tips/facts about air quality and environmental protection
 */
const dailyTips = [
  {
    title: "Use Public Transportation",
    fact: "Taking public transportation instead of driving can reduce your carbon footprint by up to 30%.",
    tip: "Try to use public transportation, carpool, bike, or walk whenever possible to reduce air pollution from vehicle emissions."
  },
  {
    title: "Plant Trees",
    fact: "A single mature tree can absorb up to 48 pounds of carbon dioxide per year and release enough oxygen for two people.",
    tip: "Plant native trees and plants in your garden to help improve local air quality."
  },
  {
    title: "Conserve Energy",
    fact: "Electricity generation is one of the largest sources of air pollution globally.",
    tip: "Turn off lights and electronics when not in use, and consider switching to energy-efficient appliances."
  },
  {
    title: "Reduce Meat Consumption",
    fact: "Livestock production contributes to approximately 14.5% of global greenhouse gas emissions.",
    tip: "Consider having one or more meat-free days each week to reduce your environmental impact."
  },
  {
    title: "Avoid Burning Waste",
    fact: "Burning trash releases toxic pollutants including dioxins, lead, and mercury into the air.",
    tip: "Never burn trash or yard waste. Instead, compost organic materials and recycle other waste properly."
  },
  {
    title: "Use Air Purifiers",
    fact: "HEPA air purifiers can remove up to 99.97% of airborne particles as small as 0.3 microns.",
    tip: "Consider using air purifiers with HEPA filters in your home, especially in bedrooms and living areas."
  },
  {
    title: "Indoor Plants",
    fact: "NASA research has shown that certain houseplants can help remove indoor air pollutants.",
    tip: "Add plants like spider plants, peace lilies, and snake plants to your home to help improve indoor air quality."
  },
  {
    title: "Choose Zero-VOC Products",
    fact: "Traditional paints and many cleaning products release volatile organic compounds (VOCs) that contribute to indoor air pollution.",
    tip: "When renovating or cleaning, choose zero-VOC or low-VOC paints, adhesives, and cleaning products."
  },
  {
    title: "Morning Exercise",
    fact: "Ozone levels tend to be lower in the morning and higher in the afternoon on hot, sunny days.",
    tip: "On days with poor air quality, schedule outdoor exercise in the early morning when pollution levels are typically lower."
  },
  {
    title: "Check AQI Daily",
    fact: "Exposure to air pollution increases the risk of respiratory infections, heart disease, and lung cancer.",
    tip: "Make checking the Air Quality Index (AQI) part of your daily routine, just like checking the weather."
  },
  {
    title: "Proper Mask Usage",
    fact: "N95 masks can filter out at least 95% of airborne particles, including most pollutants.",
    tip: "On days with poor air quality, consider wearing an N95 mask when outdoors, especially for prolonged periods."
  },
  {
    title: "Reduce Idling",
    fact: "An idling vehicle can release as much pollution as a moving one.",
    tip: "Turn off your engine when parked or waiting for more than 10 seconds to reduce unnecessary emissions."
  },
  {
    title: "Regular HVAC Maintenance",
    fact: "Dirty air filters can reduce airflow and energy efficiency while increasing indoor air pollution.",
    tip: "Change your home's air filters regularly and schedule professional HVAC maintenance at least annually."
  },
  {
    title: "Grow Your Own Food",
    fact: "The average meal travels about 1,500 miles from farm to plate in the United States.",
    tip: "Growing your own fruits and vegetables reduces transportation emissions and provides fresher, healthier food."
  },
  {
    title: "Reduce Single-Use Plastics",
    fact: "Plastic production and incineration will add more than 850 million metric tons of greenhouse gases to the atmosphere in 2019 alone.",
    tip: "Use reusable bags, bottles, and containers to reduce plastic pollution and its associated emissions."
  }
];

/**
 * Get a random daily tip
 * @returns {Object} A random daily tip
 */
function getRandomDailyTip() {
  const randomIndex = Math.floor(Math.random() * dailyTips.length);
  return dailyTips[randomIndex];
}

/**
 * Get a daily tip based on the date
 * @returns {Object} A daily tip
 */
function getDailyTip() {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  const index = dayOfYear % dailyTips.length;
  return dailyTips[index];
}

module.exports = {
  getRandomDailyTip,
  getDailyTip
};
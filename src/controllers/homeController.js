const { fetchEnvironmentalNews } = require('../services/newsService');
const { getDailyTip } = require('../utils/dailyTips');
const { pollutantInfo } = require('../utils/pollutantInfo');
const { getPollutionImpactSimulations } = require('../utils/pollutionImpact');
const { getCurrentData } = require('../services/firebase');
const { config } = require('../config');

/**
 * Get homepage data including news, daily tip, and pollution impacts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getHomepage(req, res, next) {
  try {
    const sensorId = config.sensors.sensorIds['Jalan Radio'];
    const currentData = await getCurrentData(sensorId);

    const news = await fetchEnvironmentalNews();
    const dailyTip = getDailyTip();
    const pollutionImpacts = currentData
      ? getPollutionImpactSimulations(currentData)
      : [];

    let dominantPollutantInfo = null;
    if (currentData?.dominant_pollutant) {
      dominantPollutantInfo = pollutantInfo[currentData.dominant_pollutant] || null;
    }

    const response = {
      title: "SkyLENS Air Quality Monitoring System",
      news: {
        title: "Latest Environmental News",
        articles: news,
        lastUpdated: new Date().toISOString()
      },
      dailyTip,
      pollutionImpacts,
      pollutantInfo: dominantPollutantInfo
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getHomepage
};
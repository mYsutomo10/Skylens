const axios = require('axios');
const NodeCache = require('node-cache');
const { config } = require('../config');

let newsCache = null;
let cacheTtl = 10800; // default 3 jam
let initialized = false;

/**
 * Inisialisasi cache setelah config tersedia
 */
async function initializeCache() {
  if (initialized) return;

  cacheTtl = config.gnews.cacheTtl;
  newsCache = new NodeCache({ stdTTL: cacheTtl });
  initialized = true;
}

/**
 * Fetch environmental news from GNews API
 */
async function fetchEnvironmentalNews() {
  try {
    await initializeCache();

    const CACHE_KEY = 'environmental_news';
    const cachedNews = newsCache.get(CACHE_KEY);
    if (cachedNews) {
      return cachedNews;
    }

    const response = await axios.get(`${config.gnews.apiUrl}/search`, {
      params: {
        q: 'air pollution OR environment OR climate',
        lang: 'en',
        country: 'us',
        max: 10,
        apikey: config.gnews.apiKey
      }
    });

    const news = response.data.articles || [];
    const processedNews = news.map(article => ({
      title: article.title,
      description: article.description,
      content: article.content,
      url: article.url,
      image: article.image,
      publishedAt: article.publishedAt,
      source: article.source.name
    }));

    newsCache.set(CACHE_KEY, processedNews);
    return processedNews;
  } catch (error) {
    console.error('Error fetching environmental news:', error);
    return newsCache?.get('environmental_news') || [];
  }
}

module.exports = {
  fetchEnvironmentalNews
};
const axios = require('axios');
const NodeCache = require('node-cache');
const { config } = require('../config');

// Initialize cache with TTL of 3 hours
const newsCache = new NodeCache({ stdTTL: config.gnews.cacheTtl });

const CACHE_KEY = 'environmental_news';

/**
 * Fetch environmental news from GNews API
 */
async function fetchEnvironmentalNews() {
  try {
    // Check if news is in cache
    const cachedNews = newsCache.get(CACHE_KEY);
    if (cachedNews) {
      return cachedNews;
    }

    // Fetch news from API
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
    
    // Process news data
    const processedNews = news.map(article => ({
      title: article.title,
      description: article.description,
      content: article.content,
      url: article.url,
      image: article.image,
      publishedAt: article.publishedAt,
      source: article.source.name
    }));

    // Cache the news
    newsCache.set(CACHE_KEY, processedNews);

    return processedNews;
  } catch (error) {
    console.error('Error fetching environmental news:', error);
    
    // If API call fails, return empty array or cached data if available
    return newsCache.get(CACHE_KEY) || [];
  }
}

module.exports = {
  fetchEnvironmentalNews
};
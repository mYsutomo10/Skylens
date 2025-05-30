const express = require('express');
const router = express.Router();

const homeController = require('../controllers/homeController');
const locationController = require('../controllers/locationController');

// Home route
router.get('/', homeController.getHomepage);

// Jalan Radio routes
router.get('/Jalan%20Radio', locationController.getCurrentData);
router.get('/Jalan Radio', locationController.getCurrentData);
router.get('/Jalan%20Radio/history', locationController.getHistoricalData);
router.get('/Jalan Radio/history', locationController.getHistoricalData);
router.get('/Jalan%20Radio/forecast', locationController.getForecastData);
router.get('/Jalan Radio/forecast', locationController.getForecastData);

// Baleendah routes
router.get('/Baleendah', locationController.getCurrentData);
router.get('/Baleendah/history', locationController.getHistoricalData);
router.get('/Baleendah/forecast', locationController.getForecastData);

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'SkyLENS API is running' });
});

module.exports = router;
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { loadConfig } = require('./config');
const { initializeFirebase } = require('./services/firebase');
const routes = require('./routes');

(async () => {
  try {
    // Load config
    const config = await loadConfig();

    // Initialize Firebase
    await initializeFirebase();

    // Create Express app
    const app = express();

    // Apply middleware
    app.use(helmet());
    app.use(cors());
    app.use(express.json());
    app.use(morgan('dev'));

    // Routes
    app.use('/', routes);

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error(err.stack);
      const statusCode = err.statusCode || 500;
      const message = err.message || 'Internal Server Error';

      res.status(statusCode).json({
        status: 'error',
        message,
        ...(config.isDevelopment && { stack: err.stack })
      });
    });

    // Start server
    const PORT = config.port;
    app.listen(PORT, () => {
      console.log(`SkyLENS server running on port ${PORT}`);
      console.log(`Environment: ${config.environment}`);
      console.log(`Access it at: http://localhost:${PORT}`);
    });

    module.exports = app;

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
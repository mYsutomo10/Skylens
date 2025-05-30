const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { config } = require('./config');
const { initializeFirebase } = require('./services/firebase');
const routes = require('./routes');

// Initialize Firebase
initializeFirebase();

// Create Express app
const app = express();

// Apply middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Apply routes
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
  console.log(`🚀 SkyLENS backend server running on port ${PORT}`);
  console.log(`Environment: ${config.environment}`);
  /*local test
  console.log(`🔗 Access it at: http://localhost:${PORT}`);
  */
});

module.exports = app;
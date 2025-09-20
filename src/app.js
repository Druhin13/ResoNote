const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { loadData } = require('./data/dataLoader');

// Initialize the app
const app = express();

// Load data before starting the server
loadData().catch(err => {
  console.error('Failed to load data:', err);
  process.exit(1);
});

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api', routes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`
  });
});

// Error handling
app.use(errorHandler);

module.exports = app;
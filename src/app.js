const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { loadData } = require('./data/dataLoader');

const analysisRoutes = require('./routes/analysis');
const evaluationRoutes = require('./routes/evaluation');
const mediaRoutes = require('./routes/media');

const app = express();

loadData().catch(err => {
  console.error('Failed to load data:', err);
  process.exit(1);
});

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', routes);

app.use('/api/analysis', analysisRoutes);
app.use('/api/evaluation', evaluationRoutes);
app.use('/api', mediaRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.originalUrl}`
  });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use(errorHandler);

module.exports = app;
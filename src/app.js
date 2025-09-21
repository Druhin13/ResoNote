/**
 * @file Main application entry point for the ResoNote API server.
 * Initializes middleware, loads datasets, mounts routes, and configures error handling.
 */

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const { loadData } = require("./data/dataLoader");

const analysisRoutes = require("./routes/analysis");
const evaluationRoutes = require("./routes/evaluation");
const mediaRoutes = require("./routes/media");

const app = express();

/**
 * Preload all dataset files before serving requests.
 * Terminates process if data cannot be loaded.
 */
loadData().catch((err) => {
  console.error("Failed to load data:", err);
  process.exit(1);
});

// Core middleware
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, "../public")));

// Mount API routes
app.use("/api", routes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/evaluation", evaluationRoutes);
app.use("/api", mediaRoutes);

// Fallback for unmatched API routes
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.originalUrl}`,
  });
});

// Fallback for frontend client-side routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Global error handler
app.use(errorHandler);

module.exports = app;

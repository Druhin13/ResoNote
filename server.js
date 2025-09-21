/**
 * @file Server entry point for starting the ResoNote API.
 * Loads the Express application and begins listening on the configured port.
 */

const app = require("./src/app");

const PORT = process.env.PORT || 3000;

/**
 * Start the HTTP server on the configured port.
 */
app.listen(PORT, () => {
  console.log(`ResoNote API running on port ${PORT}`);
});

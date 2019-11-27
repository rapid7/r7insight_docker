const insight = require('./');

const logger = insight.utils.start({
  json: false, // or true to parse lines as JSON
  secure: true, // or false to connect over plain TCP
  region: "eu", // specify region
  token: process.env.TOKEN, // Insight Platform TOKEN
  newline: true, // Split on newline delimited entries
});

// logger is the source stream with all the
// log lines
setTimeout(function() {
  logger.destroy();
}, 5000);

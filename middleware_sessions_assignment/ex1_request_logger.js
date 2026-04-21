const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const LOG_FILE = path.join(__dirname, "requests.log");

function requestLogger(req, res, next) {
  const startTime = Date.now();

  res.on("finish", () => {
    const responseTime = Date.now() - startTime;
    const logEntry = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${responseTime}ms\n`;
    fs.appendFile(LOG_FILE, logEntry, (err) => {
      if (err) console.error("Failed to write log:", err);
    });
  });

  next();
}

app.use(requestLogger);

app.get("/", (req, res) => {
  res.send("Home page");
});

app.get("/about", (req, res) => {
  res.send("About page");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
  console.log("Logs will be written to requests.log");
});

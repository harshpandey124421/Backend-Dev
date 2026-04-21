const express = require("express");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function escapeHTML(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

const SQL_PATTERN = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE|TRUNCATE|--)\b|;|\*)/gi;

function stripSQLInjection(str) {
  if (typeof str !== "string") return str;
  return str.replace(SQL_PATTERN, "");
}

function sanitizeObject(obj) {
  if (typeof obj !== "object" || obj === null) return stripSQLInjection(escapeHTML(obj));
  for (const key in obj) {
    if (typeof obj[key] === "object") {
      sanitizeObject(obj[key]);
    } else {
      obj[key] = stripSQLInjection(escapeHTML(String(obj[key])));
    }
  }
  return obj;
}

function sanitizeMiddleware(req, res, next) {
  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  next();
}

app.use(sanitizeMiddleware);

app.post("/submit", (req, res) => {
  res.json({ received: req.body });
});

app.listen(3000, () => console.log("Sanitization server running on port 3000"));

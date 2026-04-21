const express = require("express");
const helmet = require("helmet");
const crypto = require("crypto");

const app = express();

app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString("base64");
  next();
});

app.use((req, res, next) => {
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
      styleSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  })(req, res, next);
});

app.use(
  helmet({
    contentSecurityPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    hidePoweredBy: true,
    noSniff: true,
    frameguard: { action: "deny" },
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <style nonce="${res.locals.nonce}">body { font-family: sans-serif; }</style>
      </head>
      <body>
        <h1>React App with Nonce-Based CSP</h1>
        <script nonce="${res.locals.nonce}">console.log('Nonce-protected script');</script>
      </body>
    </html>
  `);
});

app.listen(3000, () => console.log("Nonce-based CSP server running on port 3000"));

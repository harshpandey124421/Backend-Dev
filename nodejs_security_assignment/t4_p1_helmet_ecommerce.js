const express = require("express");
const helmet = require("helmet");

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://js.stripe.com", "https://www.googletagmanager.com"],
        frameSrc: ["'self'", "https://js.stripe.com", "https://www.youtube.com"],
        connectSrc: ["'self'", "https://api.stripe.com", "https://checkout.stripe.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "https://*.stripe.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'", "https://checkout.stripe.com"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    frameguard: { action: "sameorigin" },
    hidePoweredBy: true,
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Secure e-commerce API" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(3000, () => console.log("Helmet e-commerce server running on port 3000"));

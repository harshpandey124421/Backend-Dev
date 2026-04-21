const express = require("express");
const escape = require("escape-html");

const app = express();

app.get("/search", (req, res) => {
  const query = escape(req.query.q || "");
  res.send(`<h1>Search results for: ${query}</h1>`);
});

app.listen(3000, () => console.log("XSS-safe search running on port 3000"));

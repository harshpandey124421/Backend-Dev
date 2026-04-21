const express = require("express");
const session = require("express-session");

const app = express();
app.use(express.json());

const SESSION_DURATION = 15 * 60 * 1000;
const WARNING_BEFORE = 2 * 60 * 1000;

app.use(
  session({
    secret: "timeout_secret",
    resave: true,
    saveUninitialized: false,
    cookie: { maxAge: SESSION_DURATION },
  })
);

function isAuthenticated(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Not authenticated" });
  next();
}

function trackActivity(req, res, next) {
  if (req.session.user) {
    req.session.lastActive = Date.now();
  }
  next();
}

app.use(trackActivity);

app.post("/login", (req, res) => {
  const { username } = req.body;
  req.session.user = { username };
  req.session.lastActive = Date.now();
  res.json({ message: `Welcome ${username}` });
});

app.get("/session-status", isAuthenticated, (req, res) => {
  const now = Date.now();
  const elapsed = now - req.session.lastActive;
  const remaining = SESSION_DURATION - elapsed;
  const shouldWarn = remaining <= WARNING_BEFORE;

  res.json({
    user: req.session.user,
    remainingMs: remaining,
    remainingSeconds: Math.floor(remaining / 1000),
    warning: shouldWarn,
    warningMessage: shouldWarn
      ? `Your session expires in ${Math.floor(remaining / 1000)} seconds. Please save your work.`
      : null,
  });
});

app.post("/extend-session", isAuthenticated, (req, res) => {
  req.session.lastActive = Date.now();
  req.session.cookie.maxAge = SESSION_DURATION;
  res.json({ message: "Session extended successfully" });
});

app.post("/logout", isAuthenticated, (req, res) => {
  req.session.destroy();
  res.json({ message: "Logged out" });
});

app.listen(3000, () => console.log("Session timeout server running on port 3000"));

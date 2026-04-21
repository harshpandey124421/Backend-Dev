const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/auditDB");

const userSchema = new mongoose.Schema({ username: String, password: String });
const User = mongoose.model("User", userSchema);

const sessionActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  sessionId: String,
  action: String,
  ipAddress: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now },
});
const SessionActivity = mongoose.model("SessionActivity", sessionActivitySchema);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "audit-secret-min-32-chars-long!!",
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/auditDB",
      ttl: 14 * 24 * 60 * 60,
      autoRemove: "native",
    }),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "strict", maxAge: 24 * 60 * 60 * 1000 },
    name: "sid",
  })
);

const logSessionActivity = (action) => async (req, res, next) => {
  if (req.session.userId) {
    try {
      await SessionActivity.create({
        userId: req.session.userId,
        sessionId: req.session.id,
        action,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
    } catch (err) {
      console.error("Failed to log session activity:", err);
    }
  }
  next();
};

const isAuthenticated = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated" });
  next();
};

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: "Session error" });
      req.session.userId = user._id;
      req.session.username = user.username;
      SessionActivity.create({ userId: user._id, sessionId: req.session.id, action: "login", ipAddress: req.ip, userAgent: req.get("user-agent") });
      res.json({ message: "Login successful" });
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/logout", isAuthenticated, logSessionActivity("logout"), (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.clearCookie("sid");
    res.json({ message: "Logged out" });
  });
});

app.get("/sensitive-data", isAuthenticated, logSessionActivity("access_sensitive_data"), (req, res) => {
  res.json({ message: "Sensitive data accessed", user: req.session.username });
});

app.get("/my-sessions", isAuthenticated, async (req, res) => {
  const activities = await SessionActivity.find({ userId: req.session.userId }).sort({ timestamp: -1 }).limit(50);
  res.json(activities);
});

app.listen(3000, () => console.log("Session audit server running on port 3000"));

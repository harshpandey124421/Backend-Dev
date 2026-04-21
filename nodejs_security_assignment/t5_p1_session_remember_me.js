const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/sessionDB");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const User = mongoose.model("User", userSchema);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback-dev-secret-min-32-chars!!",
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/sessionDB",
      collectionName: "sessions",
      autoRemove: "native",
    }),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production" },
    name: "sid",
  })
);

app.post("/login", async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: "Session error" });

      req.session.userId = user._id;
      req.session.username = user.username;

      if (rememberMe) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      } else {
        req.session.cookie.maxAge = 24 * 60 * 60 * 1000;
      }

      res.json({
        message: "Login successful",
        rememberMe: !!rememberMe,
        expiresIn: req.session.cookie.maxAge / 1000 / 60 + " minutes",
      });
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.clearCookie("sid");
    res.json({ message: "Logged out" });
  });
});

app.get("/profile", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated" });
  res.json({ username: req.session.username });
});

app.listen(3000, () => console.log("Remember Me session server running on port 3000"));

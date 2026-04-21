const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());

const ACCESS_SECRET = "access-secret";
const REFRESH_SECRET = "refresh-secret";
const users = [{ id: 1, username: "harsh", passwordHash: bcrypt.hashSync("Pass123!", 10) }];
const refreshTokens = new Set();

function generateAccessToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, ACCESS_SECRET, { expiresIn: "15m" });
}

function generateRefreshToken(user) {
  const token = jwt.sign({ id: user.id, username: user.username }, REFRESH_SECRET, { expiresIn: "7d" });
  refreshTokens.add(token);
  return token;
}

function verifyAccessToken(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access token missing" });
  try {
    req.user = jwt.verify(token, ACCESS_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired access token" });
  }
}

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  res.json({ accessToken, refreshToken });
});

app.post("/token/refresh", (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: "Refresh token required" });
  if (!refreshTokens.has(refreshToken)) return res.status(403).json({ error: "Invalid refresh token" });

  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    const user = users.find((u) => u.id === payload.id);
    if (!user) return res.status(403).json({ error: "User not found" });
    const newAccessToken = generateAccessToken(user);
    res.json({ accessToken: newAccessToken });
  } catch {
    refreshTokens.delete(refreshToken);
    res.status(403).json({ error: "Expired or invalid refresh token" });
  }
});

app.post("/logout", (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: "Refresh token required" });
  refreshTokens.delete(refreshToken);
  res.json({ message: "Logged out successfully" });
});

app.get("/protected", verifyAccessToken, (req, res) => {
  res.json({ message: "Protected data", user: req.user });
});

app.listen(3000, () => console.log("JWT auth server running on port 3000"));

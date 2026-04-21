const express = require("express");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const JWT_SECRET = "your_jwt_secret";

const otpStore = new Map();

function generateOTP(userId) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(userId, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
  return otp;
}

function verifyJWT(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "JWT token missing" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired JWT" });
  }
}

function verifyOTP(req, res, next) {
  const { otp } = req.body;
  const userId = req.user.id;
  const record = otpStore.get(userId);

  if (!record) return res.status(401).json({ error: "OTP not generated" });
  if (Date.now() > record.expiresAt) {
    otpStore.delete(userId);
    return res.status(401).json({ error: "OTP expired" });
  }
  if (record.otp !== otp) return res.status(401).json({ error: "Invalid OTP" });

  otpStore.delete(userId);
  next();
}

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "harsh" && password === "1234") {
    const token = jwt.sign({ id: "user_1", username }, JWT_SECRET, { expiresIn: "15m" });
    const otp = generateOTP("user_1");
    console.log("OTP for user_1:", otp);
    res.json({ token, message: "OTP sent (check console)" });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

app.delete("/account", verifyJWT, verifyOTP, (req, res) => {
  res.json({ message: `Account for ${req.user.username} deleted successfully` });
});

app.listen(3000, () => console.log("MFA server running on port 3000"));

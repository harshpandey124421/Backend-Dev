const express = require("express");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000;
const ATTEMPT_WINDOW = 60 * 60 * 1000;

const users = [{ id: 1, email: "harsh@example.com", passwordHash: bcrypt.hashSync("Pass123!", 10) }];
const loginAttempts = new Map();

function checkLoginAttempts(email) {
  const record = loginAttempts.get(email);
  if (!record) return { allowed: true };

  if (record.lockUntil && Date.now() < record.lockUntil) {
    const remainingMs = record.lockUntil - Date.now();
    const remainingMins = Math.ceil(remainingMs / 60000);
    return { allowed: false, locked: true, message: `Account locked. Try again in ${remainingMins} minute(s).` };
  }

  if (record.lockUntil && Date.now() >= record.lockUntil) {
    loginAttempts.delete(email);
    return { allowed: true };
  }

  if (record.windowStart && Date.now() - record.windowStart > ATTEMPT_WINDOW) {
    loginAttempts.delete(email);
    return { allowed: true };
  }

  if (record.count >= MAX_ATTEMPTS) {
    record.lockUntil = Date.now() + LOCKOUT_DURATION;
    return { allowed: false, locked: true, message: "Too many attempts. Account locked for 30 minutes." };
  }

  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - record.count };
}

function recordFailedAttempt(email) {
  const record = loginAttempts.get(email) || { count: 0, windowStart: Date.now(), lockUntil: null };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockUntil = Date.now() + LOCKOUT_DURATION;
  }
  loginAttempts.set(email, record);
  return MAX_ATTEMPTS - record.count;
}

function clearAttempts(email) {
  loginAttempts.delete(email);
}

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  const check = checkLoginAttempts(email);
  if (!check.allowed) {
    return res.status(429).json({ error: check.message });
  }

  const user = users.find((u) => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const remaining = recordFailedAttempt(email);
    const msg = remaining > 0
      ? `Invalid credentials. ${remaining} attempt(s) remaining.`
      : "Invalid credentials. Account is now locked for 30 minutes.";
    return res.status(401).json({ error: msg });
  }

  clearAttempts(email);
  res.json({ message: "Login successful", userId: user.id });
});

app.listen(3000, () => console.log("Rate-limited login server running on port 3000"));

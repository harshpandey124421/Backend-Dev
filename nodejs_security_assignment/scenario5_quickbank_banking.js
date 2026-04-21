const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const validator = require("validator");
const crypto = require("crypto");

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

const app = express();
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      frameSrc: ["'none'"],
      connectSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
    },
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  hidePoweredBy: true,
  noSniff: true,
  frameguard: { action: "deny" },
  referrerPolicy: { policy: "no-referrer" },
}));

app.use(express.json({ limit: "1mb" }));
app.use(mongoSanitize({ replaceWith: "_" }));

app.use(session({
  secret: process.env.SESSION_SECRET || "quickbank-secret-min-32-chars-here!!",
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/bankDB",
    ttl: 15 * 60,
    autoRemove: "native",
    crypto: { secret: process.env.SESSION_ENCRYPTION_KEY || "bankencrypt-key-min-32-chars!!" },
  }),
  resave: false,
  saveUninitialized: false,
  rolling: false,
  genid: () => crypto.randomBytes(32).toString("hex"),
  cookie: { secure: process.env.NODE_ENV === "production", httpOnly: true, sameSite: "strict", maxAge: 15 * 60 * 1000 },
  name: "bankSid",
}));

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/bankDB");

const auditLogSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  action: String,
  amount: Number,
  fromAccount: String,
  toAccount: String,
  status: String,
  ipAddress: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now },
});
const AuditLog = mongoose.model("AuditLog", auditLogSchema);

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: String,
  accountNumber: { type: String, required: true, unique: true },
  balance: { type: Number, required: true, default: 0, min: 0 },
  isLocked: { type: Boolean, default: false },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  passwordResetToken: String,
  passwordResetExpiry: Date,
  sessions: [{ sessionId: String, device: String, createdAt: Date }],
});
const User = mongoose.model("User", userSchema);

const transactionSchema = new mongoose.Schema({
  fromAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  toAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  amount: { type: Number, required: true, min: 0.01 },
  description: String,
  type: { type: String, enum: ["transfer", "payment", "deposit", "withdrawal"] },
  status: { type: String, enum: ["pending", "completed", "failed", "reversed"], default: "completed" },
  createdAt: { type: Date, default: Date.now },
});
const Transaction = mongoose.model("Transaction", transactionSchema);

const HIGH_VALUE_THRESHOLD = 1000;
const MAX_TRANSFER_DAILY = 50000;
const TRANSFER_RATE_WINDOW = 24 * 60 * 60 * 1000;

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { error: "Too many login attempts. Account may be locked." } });
const transferLimiter = rateLimit({ windowMs: 60 * 1000, max: 3, message: { error: "Transfer rate limit exceeded. Wait 1 minute." } });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
app.use("/api/", apiLimiter);

const isAuthenticated = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: "Authentication required" });
  next();
};

const sanitizeTransactionDescription = (desc) => {
  if (!desc) return "";
  return DOMPurify.sanitize(String(desc).trim().substring(0, 200), { ALLOWED_TAGS: [] });
};

const sanitizeAmount = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) throw new Error("Amount must be a positive number");
  return Math.round(num * 100) / 100;
};

app.post("/register", async (req, res) => {
  try {
    let { username, email, password } = req.body;
    if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string") return res.status(400).json({ error: "Invalid input types" });

    username = username.trim();
    if (!validator.isAlphanumeric(username) || username.length < 3 || username.length > 30) return res.status(400).json({ error: "Invalid username" });
    if (!validator.isEmail(email)) return res.status(400).json({ error: "Invalid email" });
    email = validator.normalizeEmail(email);

    if (password.length < 12 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(password)) {
      return res.status(400).json({ error: "Password must be 12+ chars with upper, lower, number, special char" });
    }

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.status(409).json({ error: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 12);
    const accountNumber = "QB" + crypto.randomBytes(8).toString("hex").toUpperCase();
    const user = await User.create({ username, email, passwordHash, accountNumber, balance: 1000 });
    res.status(201).json({ message: "Account created", accountNumber: user.accountNumber });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string") return res.status(400).json({ error: "Invalid input" });

    const user = await User.findOne({ email: validator.normalizeEmail(email) });

    if (user && user.lockUntil && user.lockUntil > new Date()) {
      const minutes = Math.ceil((user.lockUntil - new Date()) / 60000);
      await AuditLog.create({ userId: user._id, action: "login_blocked", status: "locked", ipAddress: req.ip, userAgent: req.get("user-agent") });
      return res.status(423).json({ error: `Account locked. Try again in ${minutes} minute(s).` });
    }

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      if (user) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= 5) {
          user.isLocked = true;
          user.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
        }
        await user.save();
        await AuditLog.create({ userId: user._id, action: "login_failed", status: "failed", ipAddress: req.ip, userAgent: req.get("user-agent") });
      }
      return res.status(401).json({ error: "Invalid credentials" });
    }

    user.failedLoginAttempts = 0;
    user.isLocked = false;
    user.lockUntil = null;
    await user.save();

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: "Session error" });
      req.session.userId = user._id;
      req.session.accountNumber = user.accountNumber;
      AuditLog.create({ userId: user._id, action: "login_success", status: "success", ipAddress: req.ip, userAgent: req.get("user-agent") });
      res.json({ message: "Login successful" });
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/account/balance", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select("username accountNumber balance");
    if (!user) return res.status(404).json({ error: "Account not found" });
    await AuditLog.create({ userId: req.session.userId, action: "view_balance", status: "success", ipAddress: req.ip, userAgent: req.get("user-agent") });
    res.json({ accountNumber: user.accountNumber, balance: user.balance });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/transfer", isAuthenticated, transferLimiter, async (req, res) => {
  const mongooseSession = await mongoose.startSession();
  mongooseSession.startTransaction();
  try {
    const { toAccountNumber, amount, description } = req.body;

    const sanitizedAmount = sanitizeAmount(amount);
    if (typeof toAccountNumber !== "string") return res.status(400).json({ error: "Invalid account number" });
    const sanitizedToAccount = toAccountNumber.trim().toUpperCase();
    if (!sanitizedToAccount.match(/^QB[A-F0-9]{16}$/)) return res.status(400).json({ error: "Invalid account number format" });

    const sanitizedDescription = sanitizeTransactionDescription(description);

    const fromUser = await User.findById(req.session.userId).session(mongooseSession);
    if (!fromUser) throw new Error("Sender account not found");
    if (fromUser.accountNumber === sanitizedToAccount) return res.status(400).json({ error: "Cannot transfer to your own account" });

    const toUser = await User.findOne({ accountNumber: sanitizedToAccount }).session(mongooseSession);
    if (!toUser) return res.status(404).json({ error: "Recipient account not found" });

    if (fromUser.balance < sanitizedAmount) return res.status(400).json({ error: "Insufficient funds" });
    if (sanitizedAmount > MAX_TRANSFER_DAILY) return res.status(400).json({ error: `Transfer exceeds daily limit of $${MAX_TRANSFER_DAILY}` });

    fromUser.balance = Math.round((fromUser.balance - sanitizedAmount) * 100) / 100;
    toUser.balance = Math.round((toUser.balance + sanitizedAmount) * 100) / 100;
    await fromUser.save({ session: mongooseSession });
    await toUser.save({ session: mongooseSession });

    const tx = await Transaction.create([{ fromAccountId: fromUser._id, toAccountId: toUser._id, amount: sanitizedAmount, description: sanitizedDescription, type: "transfer", status: "completed" }], { session: mongooseSession });
    await mongooseSession.commitTransaction();

    await AuditLog.create({ userId: req.session.userId, action: "transfer", amount: sanitizedAmount, fromAccount: fromUser.accountNumber, toAccount: sanitizedToAccount, status: "completed", ipAddress: req.ip, userAgent: req.get("user-agent") });
    res.json({ message: "Transfer successful", transactionId: tx[0]._id, newBalance: fromUser.balance });
  } catch (err) {
    await mongooseSession.abortTransaction();
    await AuditLog.create({ userId: req.session.userId, action: "transfer", status: "failed", ipAddress: req.ip, userAgent: req.get("user-agent") }).catch(console.error);
    res.status(400).json({ error: err.message });
  } finally {
    mongooseSession.endSession();
  }
});

app.get("/api/transactions", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const transactions = await Transaction.find({
      $or: [{ fromAccountId: req.session.userId }, { toAccountId: req.session.userId }],
    }).sort({ createdAt: -1 }).limit(50);

    await AuditLog.create({ userId: req.session.userId, action: "view_transactions", status: "success", ipAddress: req.ip, userAgent: req.get("user-agent") });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/password-reset/request", async (req, res) => {
  try {
    const { email } = req.body;
    if (!validator.isEmail(email)) return res.status(400).json({ error: "Invalid email" });

    const user = await User.findOne({ email: validator.normalizeEmail(email) });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      user.passwordResetToken = await bcrypt.hash(token, 10);
      user.passwordResetExpiry = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();
      console.log(`[DEV] Reset token for ${email}: ${token}`);
    }
    res.json({ message: "If this email exists, a reset link was sent" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/password-reset/confirm", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!validator.isEmail(email) || typeof token !== "string" || typeof newPassword !== "string") return res.status(400).json({ error: "Invalid input" });

    const user = await User.findOne({ email: validator.normalizeEmail(email), passwordResetExpiry: { $gt: new Date() } });
    if (!user || !user.passwordResetToken) return res.status(400).json({ error: "Invalid or expired reset token" });

    const valid = await bcrypt.compare(token, user.passwordResetToken);
    if (!valid) return res.status(400).json({ error: "Invalid reset token" });

    if (newPassword.length < 12 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(newPassword)) {
      return res.status(400).json({ error: "Password too weak" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordResetToken = null;
    user.passwordResetExpiry = null;
    user.failedLoginAttempts = 0;
    user.isLocked = false;
    user.lockUntil = null;
    await user.save();

    await AuditLog.create({ userId: user._id, action: "password_reset", status: "success", ipAddress: req.ip, userAgent: req.get("user-agent") });
    res.json({ message: "Password reset successful. Please login." });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/logout", isAuthenticated, (req, res) => {
  AuditLog.create({ userId: req.session.userId, action: "logout", status: "success", ipAddress: req.ip, userAgent: req.get("user-agent") }).catch(console.error);
  req.session.destroy((err) => {
    res.clearCookie("bankSid");
    res.json({ message: "Logged out" });
  });
});

app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message });
});

app.listen(3000, () => console.log("QuickBank secure server running on port 3000"));

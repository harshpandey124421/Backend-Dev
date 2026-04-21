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
const multer = require("multer");
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
    },
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  hidePoweredBy: true,
  noSniff: true,
  frameguard: { action: "deny" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));

app.use(express.json({ limit: "5mb" }));
app.use(mongoSanitize({ replaceWith: "_" }));

app.use(session({
  secret: process.env.SESSION_SECRET || "medibook-hipaa-secret-min-32-chars!!",
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/mediDB", ttl: 30 * 60, autoRemove: "native", crypto: { secret: process.env.SESSION_ENCRYPTION_KEY || "medibook-encrypt-key-min-32!!" } }),
  resave: false,
  saveUninitialized: false,
  rolling: false,
  cookie: { secure: process.env.NODE_ENV === "production", httpOnly: true, sameSite: "strict", maxAge: 30 * 60 * 1000 },
  name: "medSid",
}));

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/mediDB");

const ROLES = { PATIENT: "patient", DOCTOR: "doctor", NURSE: "nurse", ADMIN: "admin", INSURANCE: "insurance" };

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId },
  role: String,
  action: String,
  resourceType: String,
  resourceId: String,
  ipAddress: String,
  userAgent: String,
  success: Boolean,
  timestamp: { type: Date, default: Date.now },
});
const AuditLog = mongoose.model("AuditLog", auditLogSchema);

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  phone: String,
  passwordHash: String,
  role: { type: String, enum: Object.values(ROLES), required: true },
  dob: Date,
  isActive: { type: Boolean, default: true },
});
const User = mongoose.model("User", userSchema);

const appointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  scheduledAt: { type: Date, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ["scheduled", "completed", "cancelled"], default: "scheduled" },
  notes: String,
});
const Appointment = mongoose.model("Appointment", appointmentSchema);

const ALLOWED_MED_TYPES = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "medical-docs/"),
  filename: (req, file, cb) => {
    const ext = ALLOWED_MED_TYPES[file.mimetype];
    cb(null, crypto.randomBytes(20).toString("hex") + "." + ext);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => ALLOWED_MED_TYPES[file.mimetype] ? cb(null, true) : cb(new Error("Only PDF, JPEG, PNG allowed")),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const auditMiddleware = (action, resourceType) => async (req, res, next) => {
  if (req.session.userId) {
    await AuditLog.create({ userId: req.session.userId, role: req.session.userRole, action, resourceType, resourceId: req.params.id || null, ipAddress: req.ip, userAgent: req.get("user-agent"), success: true }).catch(console.error);
  }
  next();
};

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { error: "Too many login attempts" } });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use("/api/", apiLimiter);

const isAuthenticated = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: "Authentication required" });
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.session.userRole)) return res.status(403).json({ error: "Insufficient permissions" });
  next();
};

const sanitizeDate = (dateString) => {
  if (!validator.isISO8601(String(dateString))) throw new Error("Invalid date format (ISO 8601 required)");
  const d = new Date(dateString);
  if (isNaN(d.getTime())) throw new Error("Invalid date");
  return d;
};

const sanitizePhone = (phone) => {
  if (!phone) return null;
  if (!validator.isMobilePhone(String(phone), "any")) throw new Error("Invalid phone number");
  return String(phone).replace(/[\s\-\(\)]/g, "");
};

app.post("/register", async (req, res) => {
  try {
    let { username, email, password, phone, dob, role } = req.body;
    if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string") return res.status(400).json({ error: "Invalid input types" });

    username = username.trim();
    if (!validator.isAlphanumeric(username) || username.length < 3 || username.length > 30) return res.status(400).json({ error: "Invalid username" });

    if (!validator.isEmail(email)) return res.status(400).json({ error: "Invalid email" });
    email = validator.normalizeEmail(email);

    if (password.length < 12 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(password)) {
      return res.status(400).json({ error: "Password must be 12+ chars with upper, lower, number, special char" });
    }

    const sanitizedPhone = phone ? sanitizePhone(phone) : null;
    const sanitizedDob = dob ? sanitizeDate(dob) : null;
    const allowedRole = [ROLES.PATIENT, ROLES.DOCTOR].includes(role) ? role : ROLES.PATIENT;

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.status(409).json({ error: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email, passwordHash, phone: sanitizedPhone, dob: sanitizedDob, role: allowedRole });
    res.status(201).json({ message: "Registered", userId: user._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string") return res.status(400).json({ error: "Invalid input" });

    const user = await User.findOne({ email: validator.normalizeEmail(email), isActive: true });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      await AuditLog.create({ action: "login_failed", resourceType: "auth", ipAddress: req.ip, userAgent: req.get("user-agent"), success: false });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: "Session error" });
      req.session.userId = user._id;
      req.session.userRole = user.role;
      AuditLog.create({ userId: user._id, role: user.role, action: "login", resourceType: "auth", ipAddress: req.ip, userAgent: req.get("user-agent"), success: true });
      res.json({ message: "Login successful", role: user.role });
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/appointments", isAuthenticated, requireRole(ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN), async (req, res) => {
  try {
    const { doctorId, scheduledAt, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) return res.status(400).json({ error: "Invalid doctor ID" });
    const doctor = await User.findOne({ _id: doctorId, role: ROLES.DOCTOR });
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    const appointmentDate = sanitizeDate(scheduledAt);
    if (appointmentDate < new Date()) return res.status(400).json({ error: "Appointment must be in the future" });

    if (typeof reason !== "string" || reason.trim().length < 5) return res.status(400).json({ error: "Reason required (min 5 chars)" });

    const sanitizedReason = DOMPurify.sanitize(reason.trim().substring(0, 500), { ALLOWED_TAGS: [] });
    const appt = await Appointment.create({ patientId: req.session.userId, doctorId, scheduledAt: appointmentDate, reason: sanitizedReason });

    await AuditLog.create({ userId: req.session.userId, role: req.session.userRole, action: "create_appointment", resourceType: "appointment", resourceId: appt._id.toString(), ipAddress: req.ip, userAgent: req.get("user-agent"), success: true });
    res.status(201).json(appt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/appointments/:id", isAuthenticated, auditMiddleware("view_appointment", "appointment"), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid appointment ID" });
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });

    const isPatient = appt.patientId.toString() === req.session.userId.toString();
    const isDoctor = appt.doctorId.toString() === req.session.userId.toString();
    const isAdmin = req.session.userRole === ROLES.ADMIN;

    if (!isPatient && !isDoctor && !isAdmin) return res.status(403).json({ error: "Access denied" });
    res.json(appt);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/doctors/search", async (req, res) => {
  try {
    const { name, specialty } = req.query;
    if (name && typeof name !== "string") return res.status(400).json({ error: "Invalid name" });

    const query = { role: ROLES.DOCTOR, isActive: true };
    if (name) query.username = { $regex: new RegExp("^" + name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") };

    const doctors = await User.find(query).select("username email").limit(20);
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/medical-docs/upload", isAuthenticated, upload.single("document"), auditMiddleware("upload_document", "medical_doc"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ message: "Document uploaded securely", filename: req.file.filename });
});

app.get("/api/audit-logs", isAuthenticated, requireRole(ROLES.ADMIN), async (req, res) => {
  const logs = await AuditLog.find({ userId: req.query.userId || undefined }).sort({ timestamp: -1 }).limit(100);
  res.json(logs);
});

app.post("/logout", isAuthenticated, (req, res) => {
  AuditLog.create({ userId: req.session.userId, role: req.session.userRole, action: "logout", resourceType: "auth", ipAddress: req.ip, userAgent: req.get("user-agent"), success: true }).catch(console.error);
  req.session.destroy((err) => {
    res.clearCookie("medSid");
    res.json({ message: "Logged out" });
  });
});

app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "File too large" });
  console.error(err.stack);
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message });
});

app.listen(3000, () => console.log("MediBook secure server running on port 3000"));

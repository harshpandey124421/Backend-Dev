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
const path = require("path");
const crypto = require("crypto");

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

const app = express();
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://js.stripe.com"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://*.amazonaws.com"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://*.amazonaws.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      mediaSrc: ["'self'", "https://*.amazonaws.com"],
      objectSrc: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  hidePoweredBy: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(mongoSanitize({ replaceWith: "_" }));

app.use(session({
  secret: process.env.SESSION_SECRET || "edulearn-secret-min-32-chars-here!!",
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/eduDB", ttl: 24 * 60 * 60, autoRemove: "native" }),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { secure: process.env.NODE_ENV === "production", httpOnly: true, sameSite: "strict", maxAge: 8 * 60 * 60 * 1000 },
  name: "eduSid",
}));

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/eduDB");

const ROLES = { STUDENT: "student", INSTRUCTOR: "instructor", ADMIN: "admin" };
const ALLOWED_FILE_TYPES = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: String,
  role: { type: String, enum: Object.values(ROLES), default: ROLES.STUDENT },
});
const User = mongoose.model("User", userSchema);

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200 },
  description: { type: String, required: true },
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  price: { type: Number, min: 0, default: 0 },
  createdAt: { type: Date, default: Date.now },
});
const Course = mongoose.model("Course", courseSchema);

const quizSubmissionSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  answers: [{ questionId: String, answer: String }],
  submitted: { type: Boolean, default: false },
  submittedAt: Date,
  score: Number,
});
const QuizSubmission = mongoose.model("QuizSubmission", quizSubmissionSchema);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = ALLOWED_FILE_TYPES[file.mimetype];
    cb(null, crypto.randomBytes(16).toString("hex") + "." + ext);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_FILE_TYPES[file.mimetype]) cb(null, true);
  else cb(new Error("File type not allowed. Only PDF, JPEG, PNG."), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { error: "Too many login attempts" } });
const quizLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, message: { error: "Quiz submission limit reached" } });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use("/api/", apiLimiter);

const isAuthenticated = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated" });
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.session.userRole)) return res.status(403).json({ error: "Insufficient permissions" });
  next();
};

app.post("/register", async (req, res) => {
  try {
    let { username, email, password, role } = req.body;
    if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string") return res.status(400).json({ error: "Invalid input" });

    username = username.trim().toLowerCase();
    if (!validator.isEmail(email)) return res.status(400).json({ error: "Invalid email" });
    email = validator.normalizeEmail(email);

    if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({ error: "Weak password" });
    }

    const allowedRole = [ROLES.STUDENT, ROLES.INSTRUCTOR].includes(role) ? role : ROLES.STUDENT;
    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.status(409).json({ error: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, passwordHash, role: allowedRole });
    res.status(201).json({ message: "Registered", userId: user._id, role: user.role });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string") return res.status(400).json({ error: "Invalid input" });
    const user = await User.findOne({ email: validator.normalizeEmail(email) });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: "Invalid credentials" });
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: "Session error" });
      req.session.userId = user._id;
      req.session.userRole = user.role;
      res.json({ message: "Login successful", role: user.role });
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/courses", isAuthenticated, requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN), async (req, res) => {
  try {
    let { title, description, price } = req.body;
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "Title required" });

    title = validator.escape(title.trim().substring(0, 200));
    description = DOMPurify.sanitize((description || "").toString(), {
      ALLOWED_TAGS: ["p", "br", "b", "i", "em", "strong", "a", "h2", "h3", "ul", "ol", "li", "code", "pre"],
      ALLOWED_ATTR: ["href", "target"],
    });

    const priceNum = price !== undefined ? Math.max(0, parseFloat(price) || 0) : 0;
    const course = await Course.create({ title, description, instructorId: req.session.userId, price: priceNum });
    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/courses/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid course ID" });
    const course = await Course.findById(req.params.id).populate("instructorId", "username");
    if (!course) return res.status(404).json({ error: "Course not found" });
    res.json(course);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/courses/:courseId/quiz/submit", isAuthenticated, requireRole(ROLES.STUDENT), quizLimiter, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.courseId)) return res.status(400).json({ error: "Invalid course ID" });

    const existing = await QuizSubmission.findOne({ courseId: req.params.courseId, studentId: req.session.userId, submitted: true });
    if (existing) return res.status(409).json({ error: "Quiz already submitted" });

    const { answers } = req.body;
    if (!Array.isArray(answers)) return res.status(400).json({ error: "Answers must be an array" });

    const sanitizedAnswers = answers.map((a) => ({
      questionId: validator.escape(String(a.questionId || "").trim().substring(0, 50)),
      answer: validator.escape(String(a.answer || "").trim().substring(0, 500)),
    }));

    const submission = await QuizSubmission.create({
      courseId: req.params.courseId,
      studentId: req.session.userId,
      answers: sanitizedAnswers,
      submitted: true,
      submittedAt: new Date(),
    });
    res.status(201).json({ message: "Quiz submitted", submissionId: submission._id });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/upload", isAuthenticated, upload.single("document"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ message: "File uploaded", filename: req.file.filename, size: req.file.size });
});

app.post("/logout", isAuthenticated, (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.clearCookie("eduSid");
    res.json({ message: "Logged out" });
  });
});

app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "File too large (max 10MB)" });
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message });
});

app.listen(3000, () => console.log("EduLearn secure server running on port 3000"));

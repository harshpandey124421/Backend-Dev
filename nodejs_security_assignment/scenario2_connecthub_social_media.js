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
const cors = require("cors");

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

const app = express();
app.set("trust proxy", 1);

app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], imgSrc: ["'self'", "data:", "https:"], objectSrc: ["'none'"] } }, hsts: { maxAge: 31536000, includeSubDomains: true } }));

app.use(cors({
  origin: (origin, callback) => {
    const allowed = (process.env.CORS_ORIGINS || "http://localhost:3000").split(",");
    if (!origin || allowed.includes(origin)) callback(null, true);
    else callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

app.use(express.json({ limit: "5mb" }));
app.use(mongoSanitize({ replaceWith: "_" }));

app.use(session({
  secret: process.env.SESSION_SECRET || "connecthub-secret-min-32-chars!!",
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/socialDB", ttl: 24 * 60 * 60, autoRemove: "native" }),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { secure: process.env.NODE_ENV === "production", httpOnly: true, sameSite: "strict", maxAge: 24 * 60 * 60 * 1000 },
  name: "chSid",
}));

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/socialDB");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, match: /^[a-zA-Z0-9_]{3,30}$/ },
  email: { type: String, required: true, unique: true },
  passwordHash: String,
  bio: { type: String, default: "" },
  profileUrl: String,
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});
const User = mongoose.model("User", userSchema);

const postSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const Post = mongoose.model("Post", postSchema);

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const Message = mongoose.model("Message", messageSchema);

const sanitizeInput = (req, res, next) => {
  ["body", "query", "params"].forEach((loc) => {
    if (req[loc]) {
      Object.keys(req[loc]).forEach((key) => {
        if (typeof req[loc][key] === "string") req[loc][key] = req[loc][key].trim();
      });
    }
  });
  next();
};
app.use(sanitizeInput);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: "Too many auth attempts" } });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use("/api/", apiLimiter);

const isAuthenticated = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated" });
  next();
};

const sanitizers = {
  username: (v) => {
    if (typeof v !== "string") throw new Error("Username must be string");
    v = v.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(v)) throw new Error("Username: 3-30 alphanumeric or underscore");
    return v;
  },
  email: (v) => {
    if (!validator.isEmail(v)) throw new Error("Invalid email");
    return validator.normalizeEmail(v);
  },
  bio: (v) => {
    if (typeof v !== "string") return "";
    return DOMPurify.sanitize(v.trim().substring(0, 500), { ALLOWED_TAGS: ["b", "i", "em", "strong", "a"], ALLOWED_ATTR: ["href"] });
  },
  profileUrl: (v) => {
    if (!v) return null;
    if (!validator.isURL(v, { protocols: ["http", "https"], require_protocol: true })) throw new Error("Invalid profile URL");
    if (v.toLowerCase().startsWith("javascript:")) throw new Error("Invalid URL protocol");
    return v;
  },
  postContent: (v) => {
    if (typeof v !== "string") throw new Error("Content must be string");
    return DOMPurify.sanitize(v.trim().substring(0, 5000), { ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "br", "p"], ALLOWED_ATTR: ["href"] });
  },
  message: (v) => {
    if (typeof v !== "string") throw new Error("Message must be string");
    return DOMPurify.sanitize(v.trim().substring(0, 2000), { ALLOWED_TAGS: [] });
  },
};

app.post("/register", authLimiter, async (req, res) => {
  try {
    const username = sanitizers.username(req.body.username);
    const email = sanitizers.email(req.body.email);
    const bio = sanitizers.bio(req.body.bio || "");
    const profileUrl = req.body.profileUrl ? sanitizers.profileUrl(req.body.profileUrl) : null;

    if (!req.body.password || req.body.password.length < 8) return res.status(400).json({ error: "Password min 8 chars" });

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.status(409).json({ error: "User already exists" });

    const passwordHash = await bcrypt.hash(req.body.password, 10);
    const user = await User.create({ username, email, passwordHash, bio, profileUrl });
    res.status(201).json({ message: "Registered", userId: user._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string") return res.status(400).json({ error: "Invalid input" });
    const normalizedEmail = validator.normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: "Invalid credentials" });
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: "Session error" });
      req.session.userId = user._id;
      req.session.username = user.username;
      res.json({ message: "Login successful" });
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/posts", isAuthenticated, async (req, res) => {
  try {
    const content = sanitizers.postContent(req.body.content);
    if (!content) return res.status(400).json({ error: "Content required" });
    const post = await Post.create({ authorId: req.session.userId, content });
    res.status(201).json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/posts", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).limit(20).populate("authorId", "username");
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/messages", isAuthenticated, async (req, res) => {
  try {
    const { receiverId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(receiverId)) return res.status(400).json({ error: "Invalid receiver ID" });
    const content = sanitizers.message(req.body.content);
    if (!content) return res.status(400).json({ error: "Message content required" });
    const msg = await Message.create({ senderId: req.session.userId, receiverId, content });
    res.status(201).json(msg);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/messages/:userId", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ error: "Invalid user ID" });
    const messages = await Message.find({
      $or: [
        { senderId: req.session.userId, receiverId: userId },
        { senderId: userId, receiverId: req.session.userId },
      ],
    }).sort({ createdAt: 1 }).limit(100);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/profile", isAuthenticated, async (req, res) => {
  try {
    const bio = sanitizers.bio(req.body.bio || "");
    const profileUrl = req.body.profileUrl ? sanitizers.profileUrl(req.body.profileUrl) : null;
    await User.findByIdAndUpdate(req.session.userId, { bio, profileUrl });
    res.json({ message: "Profile updated", bio, profileUrl });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/logout", isAuthenticated, (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.clearCookie("chSid");
    res.json({ message: "Logged out" });
  });
});

app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message });
});

app.listen(3000, () => console.log("ConnectHub secure server running on port 3000"));

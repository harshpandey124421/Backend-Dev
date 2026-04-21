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

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

const app = express();
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://js.stripe.com", "https://www.googletagmanager.com"],
        frameSrc: ["'self'", "https://js.stripe.com", "https://www.youtube.com"],
        connectSrc: ["'self'", "https://api.stripe.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        objectSrc: ["'none'"],
        formAction: ["'self'", "https://checkout.stripe.com"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    hidePoweredBy: true,
    noSniff: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(mongoSanitize({ replaceWith: "_" }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "shopeasy-secret-min-32-chars-long!!",
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/shopDB",
      ttl: 14 * 24 * 60 * 60,
      autoRemove: "native",
    }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    },
    name: "shopSid",
  })
);

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/shopDB");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["customer", "admin"], default: "customer" },
});
const User = mongoose.model("User", userSchema);

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  description: String,
});
const Product = mongoose.model("Product", productSchema);

const reviewSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const Review = mongoose.model("Review", reviewSchema);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts. Try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests" },
});

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
    let { username, email, password } = req.body;

    if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Invalid input types" });
    }

    username = username.trim().toLowerCase();
    email = validator.normalizeEmail(email);

    if (!email || !validator.isEmail(email)) return res.status(400).json({ error: "Invalid email" });
    if (username.length < 3 || username.length > 30) return res.status(400).json({ error: "Username must be 3-30 chars" });
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: "Invalid username characters" });
    if (password.length < 8) return res.status(400).json({ error: "Password too short" });
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(password)) {
      return res.status(400).json({ error: "Password must contain uppercase, lowercase, number, and special character" });
    }

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.status(409).json({ error: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, passwordHash });
    res.status(201).json({ message: "Registered", userId: user._id });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string") return res.status(400).json({ error: "Invalid input" });

    const normalizedEmail = validator.normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

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

app.post("/logout", isAuthenticated, (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.clearCookie("shopSid");
    res.json({ message: "Logged out" });
  });
});

app.get("/api/products/search", async (req, res) => {
  try {
    const { category, name, maxPrice } = req.query;

    if (category && typeof category !== "string") return res.status(400).json({ error: "Invalid category" });
    if (name && typeof name !== "string") return res.status(400).json({ error: "Invalid name" });
    if (maxPrice !== undefined && (isNaN(parseFloat(maxPrice)) || parseFloat(maxPrice) < 0)) {
      return res.status(400).json({ error: "Invalid price" });
    }

    const query = {};
    if (category) query.category = category.trim();
    if (maxPrice) query.price = { $lte: parseFloat(maxPrice) };
    if (name) query.name = { $regex: new RegExp("^" + name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") };

    const products = await Product.find(query).limit(50);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/products/:id/reviews", isAuthenticated, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid product ID" });

    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) return res.status(400).json({ error: "Rating must be 1-5" });

    if (typeof comment !== "string" || comment.trim().length < 5) return res.status(400).json({ error: "Comment too short" });

    const sanitizedComment = DOMPurify.sanitize(comment.trim().substring(0, 1000), { ALLOWED_TAGS: [] });

    const review = await Review.create({
      productId: req.params.id,
      userId: req.session.userId,
      rating: ratingNum,
      comment: sanitizedComment,
    });
    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/admin/users", isAuthenticated, requireRole("admin"), async (req, res) => {
  const users = await User.find().select("-passwordHash").limit(100);
  res.json(users);
});

app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  const msg = process.env.NODE_ENV === "production" ? "Internal server error" : err.message;
  res.status(err.status || 500).json({ error: msg });
});

app.listen(3000, () => console.log("ShopEasy secure server running on port 3000"));

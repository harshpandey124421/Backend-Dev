const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "admin_secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 60 * 60 * 1000 },
  })
);

const users = [
  { id: 1, username: "harsh", passwordHash: bcrypt.hashSync("admin123", 10), role: "admin" },
  { id: 2, username: "rohan", passwordHash: bcrypt.hashSync("mod123", 10), role: "moderator" },
  { id: 3, username: "guest", passwordHash: bcrypt.hashSync("guest123", 10), role: "viewer" },
];

function isAuthenticated(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Not authenticated" });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.session.user?.role)) {
      return res.status(403).json({ error: "Access denied: insufficient permissions" });
    }
    next();
  };
}

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.json({ message: "Login successful", role: user.role });
});

app.post("/logout", isAuthenticated, (req, res) => {
  req.session.destroy();
  res.json({ message: "Logged out successfully" });
});

app.get("/admin/dashboard", isAuthenticated, requireRole("admin"), (req, res) => {
  res.json({ message: "Admin dashboard", user: req.session.user });
});

app.get("/admin/users", isAuthenticated, requireRole("admin", "moderator"), (req, res) => {
  res.json({ users: users.map(({ id, username, role }) => ({ id, username, role })) });
});

app.get("/admin/reports", isAuthenticated, requireRole("admin", "moderator", "viewer"), (req, res) => {
  res.json({ reports: ["Report A", "Report B", "Report C"] });
});

app.delete("/admin/users/:id", isAuthenticated, requireRole("admin"), (req, res) => {
  res.json({ message: `User ${req.params.id} deleted` });
});

app.listen(3000, () => console.log("Admin panel running on port 3000"));

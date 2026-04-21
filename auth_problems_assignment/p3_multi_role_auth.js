const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
app.use(session({ secret: "auth-secret", resave: false, saveUninitialized: false }));

const users = [
  { id: 1, username: "harsh", passwordHash: bcrypt.hashSync("Pass123!", 10), role: "admin" },
  { id: 2, username: "rohan", passwordHash: bcrypt.hashSync("Pass123!", 10), role: "moderator" },
  { id: 3, username: "aman", passwordHash: bcrypt.hashSync("Pass123!", 10), role: "user" },
];
const posts = [];

const isAuthenticated = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: "Not authenticated" });
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  const hierarchy = { user: 1, moderator: 2, admin: 3 };
  const userLevel = hierarchy[req.session.user?.role] || 0;
  const requiredLevel = Math.min(...roles.map((r) => hierarchy[r] || 99));
  if (userLevel < requiredLevel) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  next();
};

const isOwnerOrModerator = (req, res, next) => {
  const post = posts.find((p) => p.id === parseInt(req.params.id));
  if (!post) return res.status(404).json({ error: "Post not found" });
  const user = req.session.user;
  const isOwner = post.authorId === user.id;
  const isMod = user.role === "moderator" || user.role === "admin";
  if (!isOwner && !isMod) return res.status(403).json({ error: "Not authorized to modify this post" });
  req.post = post;
  next();
};

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.json({ message: "Logged in", role: user.role });
});

app.post("/posts", isAuthenticated, (req, res) => {
  const { title, content } = req.body;
  const post = { id: posts.length + 1, title, content, authorId: req.session.user.id, createdAt: new Date() };
  posts.push(post);
  res.status(201).json({ message: "Post created", post });
});

app.put("/posts/:id", isAuthenticated, isOwnerOrModerator, (req, res) => {
  const { title, content } = req.body;
  if (title) req.post.title = title;
  if (content) req.post.content = content;
  req.post.updatedAt = new Date();
  res.json({ message: "Post updated", post: req.post });
});

app.delete("/posts/:id", isAuthenticated, requireRole("moderator"), (req, res) => {
  const idx = posts.findIndex((p) => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "Post not found" });
  posts.splice(idx, 1);
  res.json({ message: "Post deleted" });
});

app.get("/admin/users", isAuthenticated, requireRole("admin"), (req, res) => {
  res.json(users.map(({ id, username, role }) => ({ id, username, role })));
});

app.listen(3000, () => console.log("Multi-role auth server running on port 3000"));

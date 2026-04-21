const express = require("express");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
app.use(session({ secret: "passport-secret", resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

const JWT_SECRET = "jwt-secret";
const users = [{ id: 1, username: "harsh", passwordHash: bcrypt.hashSync("Pass123!", 10) }];

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = users.find((u) => u.id === id);
  done(null, user || false);
});

passport.use(
  "local",
  new LocalStrategy({ usernameField: "username", passwordField: "password" }, async (username, password, done) => {
    const user = users.find((u) => u.username === username);
    if (!user) return done(null, false, { message: "User not found" });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return done(null, false, { message: "Incorrect password" });
    return done(null, user);
  })
);

passport.use(
  "jwt",
  new JwtStrategy(
    { jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: JWT_SECRET },
    (payload, done) => {
      const user = users.find((u) => u.id === payload.id);
      if (!user) return done(null, false);
      return done(null, user);
    }
  )
);

app.post("/auth/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || "Login failed" });
    req.logIn(user, (err) => {
      if (err) return next(err);
      res.json({ message: "Logged in via session", username: user.username });
    });
  })(req, res, next);
});

app.post("/auth/api-login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || "Login failed" });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
  })(req, res, next);
});

app.get("/dashboard", (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
  res.json({ message: "Session dashboard", user: req.user.username });
});

app.get("/api/profile", passport.authenticate("jwt", { session: false }), (req, res) => {
  res.json({ message: "JWT profile", user: req.user.username, id: req.user.id });
});

app.post("/auth/logout", (req, res) => {
  req.logout(() => res.json({ message: "Logged out" }));
});

app.listen(3000, () => console.log("Passport server running on port 3000"));

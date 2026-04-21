const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoSanitize = require("express-mongo-sanitize");

const app = express();
app.use(express.json());
app.use(mongoSanitize());

mongoose.connect("mongodb://localhost:27017/adminDB");

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    validate: { validator: (v) => /^[a-zA-Z0-9_]+$/.test(v), message: "Invalid username" },
  },
  password: { type: String, required: true, minlength: 8 },
});
const Admin = mongoose.model("Admin", adminSchema);

function generateToken(admin) {
  return jwt.sign({ id: admin._id, username: admin.username }, process.env.JWT_SECRET || "secret", { expiresIn: "1h" });
}

app.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Invalid input" });
    }
    if (!username.trim() || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const admin = await Admin.findOne({ username: username.trim() });
    if (!admin) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    res.json({ token: generateToken(admin) });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(3000, () => console.log("Secure admin login running on port 3000"));

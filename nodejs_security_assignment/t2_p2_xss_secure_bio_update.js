const express = require("express");
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const mongoose = require("mongoose");

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

const app = express();
app.use(express.json());

mongoose.connect("mongodb://localhost:27017/socialDB");

const userSchema = new mongoose.Schema({ username: String, bio: String });
const User = mongoose.model("User", userSchema);

function isAuthenticated(req, res, next) {
  if (!req.headers["x-user-id"]) return res.status(401).json({ error: "Not authenticated" });
  req.user = { id: req.headers["x-user-id"] };
  next();
}

app.put("/profile/bio", isAuthenticated, async (req, res) => {
  try {
    let { bio } = req.body;
    if (!bio) return res.status(400).json({ error: "Bio required" });

    bio = DOMPurify.sanitize(bio, {
      ALLOWED_TAGS: ["b", "i", "em", "strong", "a"],
      ALLOWED_ATTR: ["href"],
      ALLOWED_URI_REGEXP: /^https?:\/\//,
    });

    if (bio.length > 500) {
      return res.status(400).json({ error: "Bio too long (max 500 chars)" });
    }

    await User.findByIdAndUpdate(req.user.id, { bio });
    res.json({ message: "Bio updated", bio });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(3000, () => console.log("Secure bio update running on port 3000"));

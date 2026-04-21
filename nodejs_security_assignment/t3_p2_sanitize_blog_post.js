const express = require("express");
const validator = require("validator");
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const mongoose = require("mongoose");

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

const app = express();
app.use(express.json());

mongoose.connect("mongodb://localhost:27017/blogDB");

const postSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200 },
  content: { type: String, required: true },
  tags: [String],
  slug: String,
  publishDate: Date,
});
const Post = mongoose.model("Post", postSchema);

function sanitizeBlogPost(post) {
  const sanitized = {};

  if (typeof post.title !== "string") throw new Error("Title must be a string");
  sanitized.title = validator.escape(post.title.trim().substring(0, 200));
  if (!sanitized.title) throw new Error("Title is required");

  if (typeof post.content !== "string") throw new Error("Content must be a string");
  sanitized.content = DOMPurify.sanitize(post.content, {
    ALLOWED_TAGS: ["p", "br", "b", "i", "em", "strong", "a", "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "code", "pre"],
    ALLOWED_ATTR: ["href", "target"],
  });
  if (!sanitized.content) throw new Error("Content is required");

  sanitized.tags = Array.isArray(post.tags)
    ? post.tags
        .filter((t) => typeof t === "string")
        .map((t) => validator.escape(t.trim().toLowerCase()))
        .filter((t) => t.length > 0 && t.length <= 30)
        .slice(0, 10)
    : [];

  if (post.publishDate) {
    if (!validator.isISO8601(String(post.publishDate))) throw new Error("Invalid publish date format");
    sanitized.publishDate = new Date(post.publishDate);
    if (isNaN(sanitized.publishDate.getTime())) throw new Error("Invalid publish date");
  } else {
    sanitized.publishDate = new Date();
  }

  sanitized.slug = sanitized.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized;
}

app.post("/posts", async (req, res) => {
  try {
    const sanitizedPost = sanitizeBlogPost(req.body);
    const post = await Post.create(sanitizedPost);
    res.status(201).json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("Blog post sanitizer running on port 3000"));

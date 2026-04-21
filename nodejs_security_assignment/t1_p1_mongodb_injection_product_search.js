const express = require("express");
const mongoose = require("mongoose");
const mongoSanitize = require("express-mongo-sanitize");

const app = express();
app.use(express.json());
app.use(mongoSanitize({ replaceWith: "_" }));

mongoose.connect("mongodb://localhost:27017/shopDB");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  description: String,
});
const Product = mongoose.model("Product", productSchema);

app.get("/products", async (req, res) => {
  try {
    const { category, price, name } = req.query;

    if (category && typeof category !== "string") {
      return res.status(400).json({ error: "Invalid category" });
    }
    if (price !== undefined && (isNaN(parseFloat(price)) || parseFloat(price) < 0)) {
      return res.status(400).json({ error: "Invalid price" });
    }
    if (name && typeof name !== "string") {
      return res.status(400).json({ error: "Invalid name" });
    }

    const query = {};
    if (category) query.category = category.trim();
    if (price) query.price = { $lte: parseFloat(price) };
    if (name) query.name = { $regex: new RegExp("^" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") };

    const products = await Product.find(query).limit(50);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(3000, () => console.log("Secure product search running on port 3000"));

const express = require("express");
const session = require("express-session");

const app = express();
app.use(express.json());
app.use(
  session({
    secret: "cart-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

const initCart = (req, res, next) => {
  if (!req.session.cart) {
    req.session.cart = { items: [], total: 0 };
  }
  next();
};

app.use(initCart);

function recalculateTotal(cart) {
  cart.total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

app.post("/cart/add", (req, res) => {
  const { productId, name, price, quantity = 1 } = req.body;
  if (!productId || !name || price == null) {
    return res.status(400).json({ error: "productId, name, and price are required" });
  }
  const cart = req.session.cart;
  const existing = cart.items.find((i) => i.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({ productId, name, price, quantity });
  }
  recalculateTotal(cart);
  res.json({ message: "Item added to cart", cart });
});

app.put("/cart/update/:productId", (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;
  if (quantity == null || quantity < 0) {
    return res.status(400).json({ error: "Valid quantity is required" });
  }
  const cart = req.session.cart;
  const item = cart.items.find((i) => i.productId === productId);
  if (!item) return res.status(404).json({ error: "Item not found in cart" });

  if (quantity === 0) {
    cart.items = cart.items.filter((i) => i.productId !== productId);
  } else {
    item.quantity = quantity;
  }
  recalculateTotal(cart);
  res.json({ message: "Cart updated", cart });
});

app.delete("/cart/remove/:productId", (req, res) => {
  const { productId } = req.params;
  const cart = req.session.cart;
  const before = cart.items.length;
  cart.items = cart.items.filter((i) => i.productId !== productId);
  if (cart.items.length === before) return res.status(404).json({ error: "Item not found in cart" });
  recalculateTotal(cart);
  res.json({ message: "Item removed", cart });
});

app.get("/cart", (req, res) => {
  res.json(req.session.cart);
});

app.delete("/cart", (req, res) => {
  req.session.cart = { items: [], total: 0 };
  res.json({ message: "Cart cleared" });
});

app.listen(3000, () => console.log("Cart server running on port 3000"));

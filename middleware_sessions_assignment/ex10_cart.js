const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: "cart_secret",
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

const userCarts = {};

function getAnonymousCart(req) {
  try {
    return JSON.parse(req.cookies.cart || "[]");
  } catch {
    return [];
  }
}

function setAnonymousCart(res, cart) {
  res.cookie("cart", JSON.stringify(cart), { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true });
}

function migrateCart(req, res) {
  const userId = req.session.user.id;
  const anonCart = getAnonymousCart(req);

  if (!userCarts[userId]) userCarts[userId] = [];

  anonCart.forEach((anonItem) => {
    const existing = userCarts[userId].find((i) => i.productId === anonItem.productId);
    if (existing) {
      existing.quantity += anonItem.quantity;
    } else {
      userCarts[userId].push(anonItem);
    }
  });

  res.clearCookie("cart");
}

app.post("/login", (req, res) => {
  const { username } = req.body;
  req.session.user = { id: `user_${username}`, username };
  migrateCart(req, res);
  res.json({ message: `Logged in as ${username}`, cart: userCarts[req.session.user.id] });
});

app.post("/logout", (req, res) => {
  req.session.destroy();
  res.json({ message: "Logged out" });
});

app.get("/cart", (req, res) => {
  if (req.session.user) {
    const cart = userCarts[req.session.user.id] || [];
    res.json({ type: "authenticated", cart });
  } else {
    res.json({ type: "anonymous", cart: getAnonymousCart(req) });
  }
});

app.post("/cart/add", (req, res) => {
  const { productId, name, price, quantity = 1 } = req.body;

  if (req.session.user) {
    const userId = req.session.user.id;
    if (!userCarts[userId]) userCarts[userId] = [];
    const existing = userCarts[userId].find((i) => i.productId === productId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      userCarts[userId].push({ productId, name, price, quantity });
    }
    res.json({ message: "Added to cart", cart: userCarts[userId] });
  } else {
    const cart = getAnonymousCart(req);
    const existing = cart.find((i) => i.productId === productId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({ productId, name, price, quantity });
    }
    setAnonymousCart(res, cart);
    res.json({ message: "Added to anonymous cart", cart });
  }
});

app.delete("/cart/:productId", (req, res) => {
  const { productId } = req.params;

  if (req.session.user) {
    const userId = req.session.user.id;
    userCarts[userId] = (userCarts[userId] || []).filter((i) => i.productId !== productId);
    res.json({ message: "Removed from cart", cart: userCarts[userId] });
  } else {
    const cart = getAnonymousCart(req).filter((i) => i.productId !== productId);
    setAnonymousCart(res, cart);
    res.json({ message: "Removed from anonymous cart", cart });
  }
});

app.listen(3000, () => console.log("Cart server running on port 3000"));

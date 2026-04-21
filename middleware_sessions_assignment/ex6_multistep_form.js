const express = require("express");
const session = require("express-session");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: "multistep_secret",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 30 * 60 * 1000 },
  })
);

app.get("/register/step1", (req, res) => {
  res.send(`
    <form method="POST" action="/register/step1">
      <input name="name" placeholder="Full Name" required />
      <input name="email" placeholder="Email" required />
      <button type="submit">Next</button>
    </form>
  `);
});

app.post("/register/step1", (req, res) => {
  req.session.formData = { ...req.session.formData, ...req.body };
  res.redirect("/register/step2");
});

app.get("/register/step2", (req, res) => {
  if (!req.session.formData?.name) return res.redirect("/register/step1");
  res.send(`
    <form method="POST" action="/register/step2">
      <input name="username" placeholder="Username" required />
      <input name="password" type="password" placeholder="Password" required />
      <button type="submit">Next</button>
    </form>
  `);
});

app.post("/register/step2", (req, res) => {
  req.session.formData = { ...req.session.formData, ...req.body };
  res.redirect("/register/step3");
});

app.get("/register/step3", (req, res) => {
  if (!req.session.formData?.username) return res.redirect("/register/step2");
  res.send(`
    <form method="POST" action="/register/step3">
      <input name="phone" placeholder="Phone Number" required />
      <input name="address" placeholder="Address" required />
      <button type="submit">Submit</button>
    </form>
  `);
});

app.post("/register/step3", (req, res) => {
  req.session.formData = { ...req.session.formData, ...req.body };
  const finalData = req.session.formData;
  req.session.destroy();
  res.json({ message: "Registration complete", data: finalData });
});

app.listen(3000, () => console.log("Multi-step form running on port 3000"));

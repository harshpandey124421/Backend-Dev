const express = require("express");
const validator = require("validator");

const app = express();
app.use(express.json());

function sanitizePhoneNumber(phone, defaultCountry = "US") {
  if (typeof phone !== "string") throw new Error("Phone number must be a string");

  phone = phone.trim();

  if (!validator.isMobilePhone(phone, "any", { strictMode: false })) {
    throw new Error("Invalid phone number");
  }

  phone = phone.replace(/[\s\-\(\)]/g, "");

  if (!phone.startsWith("+")) {
    if (defaultCountry === "US" && !phone.startsWith("1")) {
      phone = "+1" + phone;
    } else {
      phone = "+" + phone;
    }
  }

  return phone;
}

app.post("/validate-phone", (req, res) => {
  try {
    const { phone, country } = req.body;
    const normalized = sanitizePhoneNumber(phone, country || "US");
    res.json({ original: phone, normalized });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

console.log(sanitizePhoneNumber("(555) 123-4567"));
console.log(sanitizePhoneNumber("+44 20 7123 4567"));

app.listen(3000, () => console.log("Phone sanitizer running on port 3000"));

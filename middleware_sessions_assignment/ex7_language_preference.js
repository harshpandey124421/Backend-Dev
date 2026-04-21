const express = require("express");
const cookieParser = require("cookie-parser");

const app = express();
app.use(cookieParser());

const translations = {
  en: { greeting: "Hello", farewell: "Goodbye", message: "Welcome to our site!" },
  hi: { greeting: "Namaste", farewell: "Alvida", message: "Hamari site par aapka swagat hai!" },
  fr: { greeting: "Bonjour", farewell: "Au revoir", message: "Bienvenue sur notre site!" },
  ja: { greeting: "Konnichiwa", farewell: "Sayonara", message: "Watashitachi no saito e yokoso!" },
};

const SUPPORTED_LANGS = Object.keys(translations);

function getLanguage(req) {
  const lang = req.cookies.lang;
  return SUPPORTED_LANGS.includes(lang) ? lang : "en";
}

app.get("/set-language/:lang", (req, res) => {
  const { lang } = req.params;
  if (!SUPPORTED_LANGS.includes(lang)) {
    return res.status(400).json({ error: "Unsupported language", supported: SUPPORTED_LANGS });
  }
  res.cookie("lang", lang, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true });
  res.json({ message: `Language set to ${lang}` });
});

app.get("/", (req, res) => {
  const lang = getLanguage(req);
  const t = translations[lang];
  res.json({ language: lang, ...t });
});

app.get("/clear-language", (req, res) => {
  res.clearCookie("lang");
  res.json({ message: "Language preference cleared, defaulting to English" });
});

app.listen(3000, () => console.log("Language preference server running on port 3000"));

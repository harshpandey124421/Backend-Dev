const express = require("express");
const winston = require("winston");
const mongoose = require("mongoose");

class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

const logger = winston.createLogger({
  level: "error",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: "logs/error.log" }),
    new winston.transports.Console(),
  ],
});

const errorHandler = (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  if (err.isOperational) {
    return res.status(err.statusCode).json({ error: { message: err.message, status: err.statusCode } });
  }

  console.error("CRITICAL ERROR:", err);
  res.status(500).json({ error: { message: "Internal server error", status: 500 } });
};

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/prodDB");

const userSchema = new mongoose.Schema({ username: String, email: String });
const User = mongoose.model("User", userSchema);

app.get(
  "/api/users/:id",
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ValidationError("Invalid user ID format");
    }
    const user = await User.findById(req.params.id);
    if (!user) throw new NotFoundError("User not found");
    res.json(user);
  })
);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler);

app.listen(3000, () => console.log("Production error handling server running on port 3000"));

module.exports = { AppError, ValidationError, UnauthorizedError, NotFoundError, asyncHandler };

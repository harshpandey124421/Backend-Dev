const mongoose = require("mongoose");

mongoose.connect("mongodb://localhost:27017/activityDB");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  lastLoginAt: { type: Date },
  lastLogoutAt: { type: Date },
  lastActiveAt: { type: Date },
});

userSchema.methods.login = async function () {
  this.lastLoginAt = new Date();
  this.lastActiveAt = new Date();
  await this.save();
};

userSchema.methods.logout = async function () {
  this.lastLogoutAt = new Date();
  await this.save();
};

userSchema.pre("save", function (next) {
  if (this.isModified("lastLoginAt") || this.isModified("lastLogoutAt")) {
    this.lastActiveAt = new Date();
  }
  next();
});

userSchema.pre(/^find/, function (next) {
  this.set({ lastActiveAt: new Date() });
  next();
});

const User = mongoose.model("User", userSchema);

async function demo() {
  await mongoose.connection.dropDatabase();

  const user = await User.create({ username: "harsh", email: "harsh@example.com" });

  await user.login();
  console.log("After login:", { lastLoginAt: user.lastLoginAt, lastActiveAt: user.lastActiveAt });

  await new Promise((r) => setTimeout(r, 1000));

  await user.logout();
  console.log("After logout:", { lastLogoutAt: user.lastLogoutAt });

  await mongoose.disconnect();
}

demo().catch(console.error);

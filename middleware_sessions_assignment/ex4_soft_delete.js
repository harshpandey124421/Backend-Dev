const mongoose = require("mongoose");

mongoose.connect("mongodb://localhost:27017/softDeleteDB");

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: String,
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
});

postSchema.pre(/^find/, function (next) {
  if (!this.getOptions().includeDeleted) {
    this.where({ isDeleted: false });
  }
  next();
});

postSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.save();
};

postSchema.methods.restore = async function () {
  this.isDeleted = false;
  this.deletedAt = null;
  await this.save();
};

postSchema.statics.findWithDeleted = function (filter = {}) {
  return this.find(filter).setOptions({ includeDeleted: true });
};

const Post = mongoose.model("Post", postSchema);

async function demo() {
  await mongoose.connection.dropDatabase();

  const p1 = await Post.create({ title: "Post One", content: "Hello world" });
  const p2 = await Post.create({ title: "Post Two", content: "Second post" });

  await p1.softDelete();
  console.log("Active posts:", await Post.find());
  console.log("All posts (incl. deleted):", await Post.findWithDeleted());

  await p1.restore();
  console.log("After restore:", await Post.find());

  await mongoose.disconnect();
}

demo().catch(console.error);

const { MongoClient } = require("mongodb");

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

async function run() {
  await client.connect();
  const db = client.db("libraryDB");
  const books = db.collection("books");
  const borrowings = db.collection("borrowings");

  await books.insertOne({
    title: "Clean Code",
    author: "Robert C. Martin",
    isbn: "978-0132350884",
    available: true,
    copies: 3,
  });

  const cleanCode = await books.findOne({ author: "Robert C. Martin" });
  console.log("Books by Robert C. Martin:", cleanCode);

  await books.updateOne(
    { isbn: "978-0132350884" },
    { $set: { available: false }, $inc: { copies: -1 } }
  );

  await borrowings.insertOne({
    userId: "user_101",
    bookIsbn: "978-0132350884",
    borrowedAt: new Date(),
    returnedAt: null,
  });

  const userBorrowings = await borrowings.find({ userId: "user_101" }).toArray();
  console.log("Books borrowed by user_101:", userBorrowings);

  await client.close();
}

run().catch(console.error);

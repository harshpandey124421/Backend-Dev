const { ObjectId, Decimal128, BSON } = require("bson");

const jsonDocument = {
  orderId: "12345",
  orderDate: "2024-01-15",
  totalAmount: "99.99",
  items: ["item1", "item2"],
};

const bsonDocument = {
  _id: new ObjectId(),
  orderId: parseInt(jsonDocument.orderId),
  orderDate: new Date(jsonDocument.orderDate),
  totalAmount: Decimal128.fromString(jsonDocument.totalAmount),
  items: jsonDocument.items,
};

console.log("Original JSON:");
console.log(jsonDocument);
console.log();
console.log("Converted BSON-typed Document:");
console.log(bsonDocument);
console.log();
console.log("Type checks:");
console.log("orderId type:", typeof bsonDocument.orderId);
console.log("orderDate type:", bsonDocument.orderDate instanceof Date);
console.log("totalAmount type:", bsonDocument.totalAmount instanceof Decimal128);
console.log("_id type:", bsonDocument._id instanceof ObjectId);

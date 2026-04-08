const scenarios = [
  {
    name: "Online banking system",
    type: "SQL",
    justification:
      "Requires ACID transactions, strong consistency, and complex joins between accounts, transactions, and users. Data integrity is critical — no money should be lost or duplicated.",
  },
  {
    name: "Social media platform",
    type: "NoSQL (Document/Graph)",
    justification:
      "Handles unstructured and semi-structured data like posts, comments, and likes. Needs horizontal scaling for millions of users and flexible schemas as features evolve.",
  },
  {
    name: "Real-time chat application",
    type: "NoSQL (Key-Value / Document)",
    justification:
      "Messages are written and read at high speed. NoSQL provides low latency and easy scaling. Redis can handle real-time pub/sub, and MongoDB for message persistence.",
  },
  {
    name: "Hospital patient records",
    type: "SQL",
    justification:
      "Patient data is highly relational (doctors, prescriptions, appointments, diagnoses). Requires strict data integrity, audit trails, and compliance with standards like HIPAA.",
  },
  {
    name: "IoT sensor data collection",
    type: "NoSQL (Time-Series / Column-family)",
    justification:
      "Generates massive volumes of time-stamped, append-only data. NoSQL (e.g., InfluxDB or Cassandra) handles high write throughput and time-range queries efficiently.",
  },
];

scenarios.forEach((s, i) => {
  console.log(`${i + 1}. ${s.name}`);
  console.log(`   Type: ${s.type}`);
  console.log(`   Reason: ${s.justification}`);
  console.log();
});

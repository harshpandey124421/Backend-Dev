const scenarios = [
  {
    name: "Stock trading platform",
    prioritized: ["Consistency", "Partition Tolerance"],
    sacrifices: "Availability",
    reason:
      "Stale or inconsistent stock prices can cause financial loss. Every node must reflect the latest trade data. Brief unavailability is acceptable but inconsistent reads are not.",
  },
  {
    name: "Content delivery network",
    prioritized: ["Availability", "Partition Tolerance"],
    sacrifices: "Consistency",
    reason:
      "CDNs serve static assets globally. Serving slightly outdated CSS or JS is acceptable. Uptime and speed matter most — eventual consistency is fine.",
  },
  {
    name: "Airline booking system",
    prioritized: ["Consistency", "Partition Tolerance"],
    sacrifices: "Availability",
    reason:
      "Double-booking a seat is catastrophic. The system must enforce consistency across all nodes. If a partition occurs, it should reject bookings rather than risk conflicts.",
  },
  {
    name: "Video streaming service",
    prioritized: ["Availability", "Partition Tolerance"],
    sacrifices: "Consistency",
    reason:
      "Users expect continuous playback. Slightly delayed view count updates or recommendation refresh is acceptable. Interrupting a stream due to a backend sync is not.",
  },
];

scenarios.forEach((s, i) => {
  console.log(`${i + 1}. ${s.name}`);
  console.log(`   Prioritized: ${s.prioritized.join(" + ")}`);
  console.log(`   Sacrifices: ${s.sacrifices}`);
  console.log(`   Reason: ${s.reason}`);
  console.log();
});

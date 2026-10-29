// Index creation / de-duplication. Run once before deploying the unique
// (athlete, date) feedback index — building it fails if duplicates exist.
//
//   npm run db:indexes
//
// Idempotent: safe to re-run. Never deletes data it did not create; it keeps the
// most recently updated row per (athlete, date) and only removes the rest.
import "dotenv/config";

const mongoose = (await import("mongoose")).default;
const { WorkoutFeedback } =
  await import("@/modules/training/infrastructure/persistence/WorkoutFeedback.ts");
const { Athlete } =
  await import("@/modules/athlete/infrastructure/persistence/Athlete.ts");
const { Activity } =
  await import("@/modules/activities/infrastructure/persistence/Activity.ts");
const { BackfillCursor } =
  await import("@/modules/providers/infrastructure/persistence/BackfillCursor.ts");

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not set — nothing to do.");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
const collection = mongoose.connection.db.collection("workoutfeedbacks");

const duplicates = await collection
  .aggregate([
    { $group: { _id: { athlete: "$athlete", date: "$date" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $sort: { n: -1 } },
  ])
  .toArray();

if (duplicates.length) {
  console.log(
    `Found ${duplicates.length} duplicated (athlete, date) group(s).`,
  );
  let removed = 0;
  for (const { _id, n } of duplicates) {
    const rows = await collection
      .find({ athlete: _id.athlete, date: _id.date })
      .sort({ updatedAt: -1 })
      .toArray();
    // Keep the newest row, drop the rest.
    const doomed = rows.slice(1).map((r) => r._id);
    const result = await collection.deleteMany({ _id: { $in: doomed } });
    removed += result.deletedCount;
    console.log(
      `  ${_id.athlete} ${String(_id.date).slice(0, 10)}: kept 1 of ${n}`,
    );
  }
  console.log(`Removed ${removed} duplicate row(s).`);
} else {
  console.log("No duplicates found.");
}

console.log("Creating indexes…");
await WorkoutFeedback.createIndexes();
await Athlete.createIndexes();
// Builds the activity retention TTL (90-day rolling window on `date`).
await Activity.createIndexes();
// The historical-import cursor is unique per (athlete, provider); without it a
// concurrent first step can insert a second row and both walks diverge.
await BackfillCursor.createIndexes();
const after = await collection.indexes();
for (const ix of after)
  console.log(
    `  ${ix.name} ${JSON.stringify(ix.key)}${ix.unique ? " (unique)" : ""}`,
  );
console.log("  activities retention TTL: date + 90d");

await mongoose.disconnect();
console.log("Done.");

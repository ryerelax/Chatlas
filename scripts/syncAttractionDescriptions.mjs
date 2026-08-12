// One-off / periodic maintenance script for PB14's description backfill.
//
// Fetches each attraction's description from Google Places (New) editorialSummary
// and stores it directly (no third-party re-hosting needed, unlike photos — it's
// just text). Run manually, not part of the request-serving app, so the app
// never calls Places at page-render time.
//
// Usage:
//   npm run sync:descriptions              # only attractions with no description yet
//   npm run sync:descriptions -- --force   # re-check every attraction
//   npm run sync:descriptions -- --limit=5 # cap how many attractions to process

import mongoose from "mongoose";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { findAttractionsMissingDescription } from "@/data/repositories/attractionRepository";
import { syncAttractionDescription } from "@/business/services/attractionDescriptionSyncService";

const DELAY_BETWEEN_ATTRACTIONS_MS = 200;

function parseArgs(argv) {
  const force = argv.includes("--force");
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;
  return { force, limit };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const placesApiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!placesApiKey) {
    console.error("GOOGLE_PLACES_API_KEY is not set in .env.local. Aborting.");
    process.exitCode = 1;
    return;
  }

  const { force, limit } = parseArgs(process.argv.slice(2));

  await connectToDatabase();

  let attractions = await findAttractionsMissingDescription({ force });

  if (limit) {
    attractions = attractions.slice(0, limit);
  }

  console.log(
    `Found ${attractions.length} attraction(s) to process${force ? " (--force)" : ""}.`
  );

  const summary = { synced: 0, "no-summary": 0, "no-place-id": 0, failed: 0 };

  for (const attraction of attractions) {
    try {
      const result = await syncAttractionDescription(attraction, { placesApiKey, force });
      summary[result.status] = (summary[result.status] || 0) + 1;
      console.log(`[${result.status}] ${result.name}`);
    } catch (error) {
      summary.failed += 1;
      console.error(`[failed] ${attraction.name}: ${error.message}`);
    }

    await sleep(DELAY_BETWEEN_ATTRACTIONS_MS);
  }

  console.log("\nDone.", summary);
}

main()
  .catch((error) => {
    console.error("Description sync failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

// One-off / periodic maintenance script for PB15.
//
// Fetches attraction photos from the Google Places API (New) and re-uploads them
// to Cloudinary, storing the resulting stable Cloudinary URLs on each Attraction
// document. Run manually (not part of the request-serving app) so the app never
// calls the Places Photo API at page-render time.
//
// Usage:
//   npm run sync:photos              # only attractions with no photos yet
//   npm run sync:photos -- --force   # re-sync every attraction
//   npm run sync:photos -- --limit=5 # cap how many attractions to process
//
// Requires GOOGLE_PLACES_API_KEY and the CLOUDINARY_* variables in .env.local.

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { findAttractionsMissingPhotos } from "@/repositories/attractionRepository";
import { syncAttractionPhotos } from "@/services/attractionPhotoSyncService";

const DELAY_BETWEEN_ATTRACTIONS_MS = 300;

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

  let attractions = await findAttractionsMissingPhotos({ force });

  if (limit) {
    attractions = attractions.slice(0, limit);
  }

  console.log(
    `Found ${attractions.length} attraction(s) to process${force ? " (--force)" : ""}.`
  );

  const summary = { synced: 0, skipped: 0, "no-photos": 0, "no-place-id": 0, failed: 0 };

  for (const attraction of attractions) {
    try {
      const result = await syncAttractionPhotos(attraction, { placesApiKey, force });
      summary[result.status] = (summary[result.status] || 0) + 1;
      console.log(`[${result.status}] ${result.name}${result.photoCount ? ` (${result.photoCount} photos)` : ""}`);
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
    console.error("Photo sync failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

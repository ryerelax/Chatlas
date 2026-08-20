// Bulk import for the STEP 2 new-attraction-candidate investigation
// (feasibility notes / dry-run report already reviewed and approved).
// Re-runs the same broader Places Text Search queries used in that
// investigation, applies the agreed exclusions and a general quality bar,
// then runs each survivor through the same enrichment pipeline as the
// original seed (see newAttractionImportService.js): classify location
// area, sync photos, description via editorialSummary-then-generic.
//
// Defaults to a dry-run summary - pass --commit to actually write.
// Not idempotent to re-run blindly with a wider/changed query set (each
// new candidate is a genuinely new attraction, not an update to an
// existing one) - but re-running with the SAME queries is safe: googlePlaceId
// is unique in the schema, so anything already imported is skipped by the
// existing-ID pre-filter, and any that somehow still collided would fail at
// the database's unique-index level rather than duplicating.
//
// Usage:
//   npm run import:new-attractions              # dry run
//   npm run import:new-attractions -- --commit  # actually write
//   npm run import:new-attractions -- --commit --limit=5

import mongoose from "mongoose";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { searchPlacesText } from "@/infrastructure/external/googlePlaces";
import { findAllGooglePlaceIds } from "@/data/repositories/attractionRepository";
import { importAttractionCandidate } from "@/business/services/newAttractionImportService";

// Same broader/different terms and sub-areas used in the STEP 2
// investigation, deliberately covering districts and categories the
// original seed looks thin on (Alor Gajah, Jasin, waterfalls, viewpoints,
// hiking trails, heritage buildings, galleries).
const QUERIES = [
  "things to do in Alor Gajah Melaka",
  "tourist attractions Jasin Melaka",
  "waterfalls in Melaka",
  "viewpoints in Melaka",
  "hiking trails Melaka",
  "heritage buildings Melaka",
  "recreational parks Melaka",
  "family attractions Melaka",
  "art galleries Melaka",
  "historical landmarks Melaka",
  "temples in Alor Gajah",
  "mosques in Jasin Melaka",
  "museums in Melaka",
  "nature parks Ayer Keroh",
  "beaches Tanjung Kling Melaka",
];

// Reviewed and manually rejected on the dry-run report.
const EXCLUDED_PLACE_IDS = new Set([
  "ChIJv4YPCQDx0TERQ14brJ7p7Qg", // "Melaka River" - exact duplicate of an existing record under a different Place ID
]);

const EXCLUDED_NAMES = new Set([
  "Jaya Mata Malaysia Knife Gallery (Jonker Walk)", // a knife/weapon shop, not a gallery
  "INDUSTRI RINGAN TAMAN MAJU, JASIN MELAKA 3", // industrial estate listing, not an attraction
  "Asap asap house v2", // zero reviews, address is a school - looks like a stray pin, not a real place
]);

// Matches the lowest review count among the existing active dataset (after
// excluding the unrelated "Malacca" junk record) - a floor consistent with
// what's already accepted, not an arbitrary new bar.
const MIN_REVIEWS = 3;

function parseArgs(argv) {
  const commit = argv.includes("--commit");
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  return { commit, limit: limitArg ? Number(limitArg.split("=")[1]) : undefined };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isInMelaka(address) {
  return /melaka|malacca/i.test(address);
}

async function findCandidates(apiKey, existingIds) {
  const found = new Map();

  for (const query of QUERIES) {
    console.log(`Searching: "${query}"...`);
    try {
      const results = await searchPlacesText(query, { apiKey });
      for (const result of results) {
        if (!found.has(result.googlePlaceId)) {
          found.set(result.googlePlaceId, result);
        }
      }
    } catch (error) {
      console.error(`  failed: ${error.message}`);
    }
    await sleep(300);
  }

  const candidates = [];
  const excluded = { "already-imported": 0, "out-of-state": 0, "manually-excluded": 0, "low-review-count": 0 };

  for (const result of found.values()) {
    if (existingIds.has(result.googlePlaceId)) {
      excluded["already-imported"] += 1;
      continue;
    }
    if (!isInMelaka(result.address)) {
      excluded["out-of-state"] += 1;
      continue;
    }
    if (EXCLUDED_PLACE_IDS.has(result.googlePlaceId) || EXCLUDED_NAMES.has(result.name)) {
      excluded["manually-excluded"] += 1;
      continue;
    }
    if (result.totalReviews < MIN_REVIEWS) {
      excluded["low-review-count"] += 1;
      continue;
    }
    candidates.push(result);
  }

  return { candidates, excluded, totalFound: found.size };
}

async function main() {
  const placesApiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!placesApiKey) {
    console.error("GOOGLE_PLACES_API_KEY is not set in .env.local. Aborting.");
    process.exitCode = 1;
    return;
  }

  const { commit, limit } = parseArgs(process.argv.slice(2));

  console.log("=".repeat(70));
  console.log(commit ? "COMMIT MODE - will write to the database." : "DRY RUN - no database writes. Pass --commit to write.");
  console.log("=".repeat(70));

  await connectToDatabase();

  const existingIds = new Set(await findAllGooglePlaceIds());

  const { candidates, excluded, totalFound } = await findCandidates(placesApiKey, existingIds);

  console.log(`\nTotal unique places found: ${totalFound}`);
  console.log("Excluded:", excluded);
  console.log(`Candidates to import: ${candidates.length}\n`);

  const toImport = limit ? candidates.slice(0, limit) : candidates;

  const summary = { imported: 0, failed: 0 };

  for (const candidate of toImport) {
    try {
      if (!commit) {
        console.log(`[would-import] ${candidate.name} (${candidate.totalReviews} reviews)`);
        continue;
      }

      const result = await importAttractionCandidate(candidate, { placesApiKey });
      summary.imported += 1;
      console.log(
        `[imported] ${result.name} | category=${result.category} | area=${result.locationArea} | photos=${result.photoStatus} | description=${result.descriptionSource}`
      );
    } catch (error) {
      summary.failed += 1;
      console.error(`[failed] ${candidate.name}: ${error.message}`);
    }

    await sleep(300);
  }

  console.log("\n" + "=".repeat(70));
  console.log(commit ? "DONE (committed)." : "DONE (dry run - nothing written).");
  console.log(summary);
  console.log("=".repeat(70));
}

main()
  .catch((error) => {
    console.error("New attraction import failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

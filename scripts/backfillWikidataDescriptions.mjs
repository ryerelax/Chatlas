// Wikidata coordinate-matched description backfill - write step. Reuses
// findBestWikidataMatch (scripts/previewWikidataDescriptionMatches.mjs's
// same matching logic) rather than re-deriving or hardcoding extract text,
// so a re-run reflects whatever Wikidata/Wikipedia currently says.
//
// Defaults to a dry-run summary (same shape as the preview script) - pass
// --commit to actually write. Idempotent: updateAttractionDescriptionFromWikidata
// only touches attractions with no descriptionLastEditedBy, so it's safe to
// re-run after community edits happen and it will never clobber one.
//
// Usage:
//   npm run backfill:wikidata-descriptions                # dry run
//   npm run backfill:wikidata-descriptions -- --commit     # actually write
//   npm run backfill:wikidata-descriptions -- --commit --limit=5

import mongoose from "mongoose";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import {
  findAttractionsMissingDescription,
  updateAttractionDescriptionFromWikidata,
} from "@/data/repositories/attractionRepository";
import { findBestWikidataMatch } from "@/business/services/wikidataDescriptionMatchService";

const DELAY_BETWEEN_ATTRACTIONS_MS = 500;
const MAX_RETRIES_ON_FAILURE = 1;

// Reviewed and manually rejected during dry-run approval: "Melaka River
// Park" matched Wikidata's "Malacca River" (dist 130m, sim 0.53, only
// non-generic overlap is "river") - correct entity nearby, but the extract
// describes the river itself, not the park, so it reads as off-topic. Kept
// out here (rather than tightened in the shared matching service) since
// this is a one-off editorial call on this specific attraction, not a
// general scoring rule - findBestWikidataMatch would otherwise re-select it
// on every future run since the park's description stays empty.
const MANUALLY_EXCLUDED_ATTRACTION_IDS = new Set([
  "6a50e51a10ae986b194de677", // Melaka River Park
]);

function parseArgs(argv) {
  const commit = argv.includes("--commit");
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  return { commit, limit: limitArg ? Number(limitArg.split("=")[1]) : undefined };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findBestWikidataMatchWithRetry(attraction) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES_ON_FAILURE; attempt += 1) {
    try {
      return await findBestWikidataMatch(attraction);
    } catch (error) {
      lastError = error;
      await sleep(2000);
    }
  }
  throw lastError;
}

async function main() {
  const { commit, limit } = parseArgs(process.argv.slice(2));

  console.log("=".repeat(70));
  console.log(commit ? "COMMIT MODE - will write to the database." : "DRY RUN - no database writes. Pass --commit to write.");
  console.log("=".repeat(70));

  await connectToDatabase();

  let attractions = await findAttractionsMissingDescription();

  if (limit) {
    attractions = attractions.slice(0, limit);
  }

  console.log(`\nFound ${attractions.length} attraction(s) with no description.\n`);

  const summary = {
    written: 0,
    "skipped-excluded": 0,
    "skipped-community-edited": 0,
    "no-match": 0,
    failed: 0,
  };

  for (const attraction of attractions) {
    const idString = attraction._id.toString();

    try {
      const result = await findBestWikidataMatchWithRetry(attraction);

      if (!result.selected) {
        summary["no-match"] += 1;
        console.log(`[no-match] ${attraction.name}`);
        await sleep(DELAY_BETWEEN_ATTRACTIONS_MS);
        continue;
      }

      if (MANUALLY_EXCLUDED_ATTRACTION_IDS.has(idString)) {
        summary["skipped-excluded"] += 1;
        console.log(`[skipped-excluded] ${attraction.name} (manually rejected match on review)`);
        await sleep(DELAY_BETWEEN_ATTRACTIONS_MS);
        continue;
      }

      if (!commit) {
        console.log(`[would-write] ${attraction.name} <- "${result.selected.label}" (sim=${result.selected.similarity.toFixed(2)})`);
        await sleep(DELAY_BETWEEN_ATTRACTIONS_MS);
        continue;
      }

      const updated = await updateAttractionDescriptionFromWikidata(attraction._id, result.selected.extract);

      if (!updated) {
        summary["skipped-community-edited"] += 1;
        console.log(`[skipped-community-edited] ${attraction.name}`);
      } else {
        summary.written += 1;
        console.log(`[written] ${attraction.name} <- "${result.selected.label}"`);
      }
    } catch (error) {
      summary.failed += 1;
      console.error(`[failed] ${attraction.name}: ${error.message}`);
    }

    await sleep(DELAY_BETWEEN_ATTRACTIONS_MS);
  }

  console.log("\n" + "=".repeat(70));
  console.log(commit ? "DONE (committed)." : "DONE (dry run - nothing written).");
  console.log(summary);
  console.log("=".repeat(70));
}

main()
  .catch((error) => {
    console.error("Wikidata description backfill failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

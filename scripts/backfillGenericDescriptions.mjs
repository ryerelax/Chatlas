// Generic-template description backfill - fallback for attractions the
// Wikidata coordinate-match backfill (scripts/backfillWikidataDescriptions.mjs)
// couldn't cover. Builds a short sentence from verified fields only
// (category, locationArea) - never invents facts about the specific place.
//
// Defaults to a dry-run summary - pass --commit to actually write.
// Idempotent: updateAttractionDescriptionGeneric only touches attractions
// with no descriptionLastEditedBy, so re-running after community edits
// happen is safe and will never clobber one.
//
// Usage:
//   npm run backfill:generic-descriptions              # dry run
//   npm run backfill:generic-descriptions -- --commit  # actually write

import mongoose from "mongoose";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import {
  findAttractionsMissingDescription,
  updateAttractionDescriptionGeneric,
} from "@/data/repositories/attractionRepository";
import { buildGenericDescription, hasPhraseForAllCategories } from "@/business/services/genericDescriptionService";

function parseArgs(argv) {
  return { commit: argv.includes("--commit") };
}

async function main() {
  if (!hasPhraseForAllCategories()) {
    throw new Error("genericDescriptionService is missing a phrase for a valid attraction category.");
  }

  const { commit } = parseArgs(process.argv.slice(2));

  console.log("=".repeat(70));
  console.log(commit ? "COMMIT MODE - will write to the database." : "DRY RUN - no database writes. Pass --commit to write.");
  console.log("=".repeat(70));

  await connectToDatabase();

  const attractions = await findAttractionsMissingDescription();

  console.log(`\nFound ${attractions.length} attraction(s) with no description.\n`);

  const summary = { written: 0, "skipped-community-edited": 0, failed: 0 };

  for (const attraction of attractions) {
    const description = buildGenericDescription(attraction);

    try {
      if (!commit) {
        console.log(`[would-write] ${attraction.name} <- "${description}"`);
        continue;
      }

      const updated = await updateAttractionDescriptionGeneric(attraction._id, description);

      if (!updated) {
        summary["skipped-community-edited"] += 1;
        console.log(`[skipped-community-edited] ${attraction.name}`);
      } else {
        summary.written += 1;
        console.log(`[written] ${attraction.name} <- "${description}"`);
      }
    } catch (error) {
      summary.failed += 1;
      console.error(`[failed] ${attraction.name}: ${error.message}`);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(commit ? "DONE (committed)." : "DONE (dry run - nothing written).");
  console.log(summary);
  console.log("=".repeat(70));
}

main()
  .catch((error) => {
    console.error("Generic description backfill failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

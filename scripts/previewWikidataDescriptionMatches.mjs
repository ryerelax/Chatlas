// DRY-RUN ONLY. Previews the Wikidata coordinate-matched description
// backfill from the feasibility investigation - queries Wikidata/Wikipedia
// for each attraction with no description and reports proposed matches for
// manual review. Makes no database writes.
//
// TODO: Add the real write step (description + descriptionSource: "wikidata")
// once dry-run output has been reviewed and approved.
//
// Usage:
//   npm run preview:wikidata-descriptions
//   npm run preview:wikidata-descriptions -- --limit=10
//   npm run preview:wikidata-descriptions -- --threshold=0.5 --radius=0.2

import mongoose from "mongoose";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { findAttractionsMissingDescription } from "@/data/repositories/attractionRepository";
import {
  findBestWikidataMatch,
  DEFAULT_RADIUS_KM,
  DEFAULT_SIMILARITY_THRESHOLD,
} from "@/business/services/wikidataDescriptionMatchService";

const DELAY_BETWEEN_ATTRACTIONS_MS = 400;

function parseArgs(argv) {
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const radiusArg = argv.find((arg) => arg.startsWith("--radius="));
  const thresholdArg = argv.find((arg) => arg.startsWith("--threshold="));

  return {
    limit: limitArg ? Number(limitArg.split("=")[1]) : undefined,
    radiusKm: radiusArg ? Number(radiusArg.split("=")[1]) : DEFAULT_RADIUS_KM,
    similarityThreshold: thresholdArg ? Number(thresholdArg.split("=")[1]) : DEFAULT_SIMILARITY_THRESHOLD,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printCandidate(candidate, { isSelected }) {
  const marker = isSelected ? "  -> SELECTED" : `  -  ${candidate.rejectReason || ""}`;
  const dist = candidate.distanceKm != null ? `${Math.round(candidate.distanceKm * 1000)}m` : "?";
  const sim = candidate.similarity != null ? candidate.similarity.toFixed(2) : "?";
  console.log(
    `${marker.padEnd(28)} ${candidate.label || "(no label)"} [${candidate.qid}] dist=${dist} sim=${sim}`
  );
}

async function main() {
  const { limit, radiusKm, similarityThreshold } = parseArgs(process.argv.slice(2));

  console.log("=".repeat(70));
  console.log("DRY RUN - Wikidata description match preview. No database writes.");
  console.log(`radius=${radiusKm}km  similarityThreshold=${similarityThreshold}`);
  console.log("=".repeat(70));

  await connectToDatabase();

  let attractions = await findAttractionsMissingDescription();

  if (limit) {
    attractions = attractions.slice(0, limit);
  }

  console.log(`\nFound ${attractions.length} attraction(s) with no description.\n`);

  const summary = {
    matched: 0,
    "no-eligible-match": 0,
    "no-entities-in-radius": 0,
    "no-coordinates": 0,
    failed: 0,
  };

  const matchedForReview = [];

  for (const attraction of attractions) {
    console.log("-".repeat(70));
    console.log(`${attraction.name}  (${attraction._id})`);

    try {
      const result = await findBestWikidataMatch(attraction, { radiusKm, similarityThreshold });
      summary[result.verdict] = (summary[result.verdict] || 0) + 1;

      if (result.candidates.length === 0) {
        console.log(`  [${result.verdict}]`);
      } else {
        for (const candidate of result.candidates) {
          printCandidate(candidate, { isSelected: result.selected === candidate });
        }
      }

      if (result.selected) {
        console.log(`\n  Proposed description (source: ${result.selected.extractSource}):`);
        console.log(`  "${result.selected.extract}"`);

        matchedForReview.push({
          attractionId: attraction._id,
          attractionName: attraction.name,
          matchedQid: result.selected.qid,
          matchedLabel: result.selected.label,
          distanceKm: result.selected.distanceKm,
          similarity: result.selected.similarity,
          extractSource: result.selected.extractSource,
          extract: result.selected.extract,
        });
      }
    } catch (error) {
      summary.failed += 1;
      console.error(`  [failed] ${error.message}`);
    }

    console.log("");
    await sleep(DELAY_BETWEEN_ATTRACTIONS_MS);
  }

  console.log("=".repeat(70));
  console.log("SUMMARY (dry run - nothing written)");
  console.log(summary);
  console.log(`\n${matchedForReview.length} of ${attractions.length} would receive a description if approved as-is.`);
  console.log("=".repeat(70));
}

main()
  .catch((error) => {
    console.error("Wikidata description preview failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

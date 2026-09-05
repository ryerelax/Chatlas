// One-off / re-runnable maintenance script for PB09.
//
// Classifies every active Melaka attraction into one of the draft location-area
// zones (src/business/services/locationAreas.js), using postcode + locality-keyword rules run
// against the seeded `address` field (falling back to `name` when the address
// is too generic to classify). Anything that still doesn't match falls into the
// "Other / Greater Melaka" catch-all zone rather than being force-fit into one
// of the four named tourist zones.
//
// This is a DRAFT zone list, not yet confirmed by the team. Re-run this script
// after src/business/services/locationAreas.js's rules are adjusted.
//
// Usage:
//   npm run classify:areas

import mongoose from "mongoose";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import {
  findAllActiveAttractions,
  updateAttractionLocationArea,
} from "@/data/repositories/attractionRepository";
import { LOCATION_AREAS, classifyLocationArea } from "@/business/services/locationAreas";

async function main() {
  await connectToDatabase();

  const attractions = await findAllActiveAttractions();

  const counts = Object.fromEntries(LOCATION_AREAS.map((zone) => [zone, 0]));
  counts.Unclassified = 0;
  const unclassifiedExamples = [];

  for (const attraction of attractions) {
    const zone = classifyLocationArea(attraction.address, attraction.name);

    await updateAttractionLocationArea(attraction._id, zone);

    if (zone) {
      counts[zone] += 1;
    } else {
      counts.Unclassified += 1;
      unclassifiedExamples.push(`${attraction.name} — ${attraction.address}`);
    }
  }

  console.log(`Classified ${attractions.length} attraction(s).\n`);
  console.log("Counts per zone:");
  for (const [zone, count] of Object.entries(counts)) {
    console.log(`  ${count.toString().padStart(3)}  ${zone}`);
  }

  console.log(`\nUnclassified addresses (${unclassifiedExamples.length}):`);
  for (const example of unclassifiedExamples) {
    console.log(`  - ${example}`);
  }
}

main()
  .catch((error) => {
    console.error("Location area classification failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

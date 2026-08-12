// One-off data-repair script: re-fetches the authoritative formatted address
// for a single attraction from the Google Places API (New) and corrects the
// stored `address` field. For records whose text address doesn't match their
// googlePlaceId/coordinates (a seeding-time glitch), while everything else on
// the record (name, lat/lng, googlePlaceId) stays correct.
//
// Usage:
//   npm run fix:address -- <attractionId>
//
// Example (Straits Mosque sunset viewpoint, seeded with a Kuala Lumpur
// address despite its coordinates sitting in Melaka town):
//   npm run fix:address -- 6a50e51a10ae986b194de69c

import mongoose from "mongoose";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import {
  findAttractionByIdForRepair,
  updateAttractionAddress,
} from "@/data/repositories/attractionRepository";
import { fetchPlaceFormattedAddress } from "@/infrastructure/googlePlaces";

async function main() {
  const attractionId = process.argv[2];

  if (!attractionId) {
    console.error("Usage: npm run fix:address -- <attractionId>");
    process.exitCode = 1;
    return;
  }

  const placesApiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!placesApiKey) {
    console.error("GOOGLE_PLACES_API_KEY is not set in .env.local. Aborting.");
    process.exitCode = 1;
    return;
  }

  await connectToDatabase();

  const attraction = await findAttractionByIdForRepair(attractionId);

  if (!attraction) {
    console.error(`No attraction found with id ${attractionId}.`);
    process.exitCode = 1;
    return;
  }

  if (!attraction.googlePlaceId) {
    console.error(`${attraction.name} has no googlePlaceId to re-fetch from.`);
    process.exitCode = 1;
    return;
  }

  const correctedAddress = await fetchPlaceFormattedAddress(attraction.googlePlaceId, placesApiKey);

  console.log(`Attraction: ${attraction.name}`);
  console.log(`Old address: ${attraction.address}`);
  console.log(`New address: ${correctedAddress}`);

  await updateAttractionAddress(attraction._id, correctedAddress);
  console.log("\nUpdated.");
}

main()
  .catch((error) => {
    console.error("Address repair failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

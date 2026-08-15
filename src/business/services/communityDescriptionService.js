import mongoose from "mongoose";
import { updateAttractionDescriptionByUser } from "@/data/repositories/attractionRepository";
import { isMelakaBasedUser } from "@/business/services/locationGate";
import { MAX_DESCRIPTION_LENGTH, isValidDescriptionLength } from "@/business/services/descriptionValidation";

// Any Melaka-based logged-in user can edit the "About this attraction" text
// for any existing active attraction — direct edit, published immediately,
// no approval queue. Separate from the Reviews module.
export class LocationNotAllowedError extends Error {}
export class InvalidDescriptionError extends Error {}
export class AttractionNotFoundError extends Error {}

export async function updateCommunityDescription({ attractionId, session, description }) {
  if (!isMelakaBasedUser(session)) {
    throw new LocationNotAllowedError("Available to Melaka-based users.");
  }

  if (!mongoose.Types.ObjectId.isValid(attractionId)) {
    throw new AttractionNotFoundError("Attraction not found.");
  }

  if (typeof description !== "string") {
    throw new InvalidDescriptionError("Description must be text.");
  }

  const normalizedDescription = description.trim();

  if (!isValidDescriptionLength(normalizedDescription)) {
    throw new InvalidDescriptionError(
      `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`
    );
  }

  const editedBy = {
    googleId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    editedAt: new Date(),
  };

  const updatedAttraction = await updateAttractionDescriptionByUser(
    attractionId,
    normalizedDescription,
    editedBy
  );

  if (!updatedAttraction) {
    throw new AttractionNotFoundError("Attraction not found.");
  }

  return updatedAttraction;
}

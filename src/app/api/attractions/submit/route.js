export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import {
  submitAttraction,
  InvalidSubmissionError,
  DuplicateAttractionError,
} from "@/business/services/attractionSubmissionService";

// POST - Decision 4: Registered-User self-service "Add Attraction" submission.
// Publishes immediately on success — no admin review queue.
export async function POST(request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { googlePlaceId, category, sessionToken } = body;

    await connectToDatabase();

    const attraction = await submitAttraction({
      googlePlaceId,
      category,
      sessionToken,
      session,
      apiKey: process.env.GOOGLE_PLACES_API_KEY,
    });

    return NextResponse.json(
      { success: true, data: attraction },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof InvalidSubmissionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    if (error instanceof DuplicateAttractionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 409 }
      );
    }

    console.error("Failed to submit attraction:", error);

    return NextResponse.json(
      { success: false, message: "Failed to submit attraction." },
      { status: 500 }
    );
  }
}

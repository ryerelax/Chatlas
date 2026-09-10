export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import {
  updateCommunityDescription,
  LocationNotAllowedError,
  InvalidDescriptionError,
  AttractionNotFoundError,
} from "@/business/services/communityDescriptionService";

// PATCH - community "About this attraction" edit. Any logged-in,
// Melaka-based user can edit any existing active attraction's description.
// Published immediately, no approval queue. Empty string is a valid value
// (clears the description back to blank).
export async function PATCH(request, { params }) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    await connectToDatabase();

    const attraction = await updateCommunityDescription({
      attractionId: id,
      session,
      description: body.description,
    });

    return NextResponse.json({ success: true, data: attraction });
  } catch (error) {
    if (error instanceof LocationNotAllowedError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 403 }
      );
    }

    if (error instanceof InvalidDescriptionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    if (error instanceof AttractionNotFoundError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 404 }
      );
    }

    console.error("Failed to update attraction description:", error);

    return NextResponse.json(
      { success: false, message: "Failed to update description." },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchPlaces } from "@/business/services/attractionSubmissionService";

// GET - Places (New) Autocomplete proxy for Decision 4's Add Attraction
// search. Gated behind auth() (not just the submit endpoint) so this isn't an
// open unauthenticated route anyone could hit to burn Places API quota.
export async function GET(request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const sessionToken = searchParams.get("sessionToken") || "";

    const results = await searchPlaces(query, {
      sessionToken,
      apiKey: process.env.GOOGLE_PLACES_API_KEY,
    });

    return NextResponse.json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Failed to search places:", error);

    return NextResponse.json(
      { success: false, message: "Failed to search places." },
      { status: 500 }
    );
  }
}

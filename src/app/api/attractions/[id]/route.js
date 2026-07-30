import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getAttractions } from "@/services/attractionService";

export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const location = searchParams.get("location") || "";
    const minRating = searchParams.get("minRating") || 0;

    const attractions = await getAttractions({
      search,
      category,
      location,
      minRating,
    });

    return NextResponse.json({
      success: true,
      count: attractions.length,
      data: attractions,
    });
  } catch (error) {
    console.error("Failed to retrieve attractions:", error);

    // TODO: Return more specific error messages after final API error handling is designed.
    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve attractions.",
      },
      { status: 500 }
    );
  }
}
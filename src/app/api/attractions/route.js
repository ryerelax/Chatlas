import { NextResponse } from "next/server";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { getAttractions } from "@/business/services/attractionService";

export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);

    const filters = {
      search: searchParams.get("search") || "",
      category: searchParams.get("category") || "",
      minRating: searchParams.get("minRating") || "0",
    };

    const attractions = await getAttractions(filters);

    return NextResponse.json({
      success: true,
      count: attractions.length,
      data: attractions,
    });
  } catch (error) {
    console.error("Failed to retrieve attractions:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve attractions.",
      },
      { status: 500 }
    );
  }

  // TODO: Add pagination parameters when the attraction dataset becomes large enough to require paginated results.
}
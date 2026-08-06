import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getAttractions } from "@/services/attractionService";

export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const minRating = Number(searchParams.get("minRating")) || 0;

    const attractions = await getAttractions({ search, category, minRating });

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
}

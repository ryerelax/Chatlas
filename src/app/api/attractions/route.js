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
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const locationArea = searchParams.get("locationArea") || "";
    const minRating = searchParams.get("minRating") || 0;
    const communitySubmitted = searchParams.get("communitySubmitted") || false;
    const page = searchParams.get("page") || 1;

    const { items, total, page: currentPage, limit, totalPages } =
      await getAttractions({ search, category, locationArea, minRating, communitySubmitted, page });

    return NextResponse.json({
      success: true,
      count: total,
      data: items,
      pagination: {
        page: currentPage,
        limit,
        totalPages,
        total,
      },
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
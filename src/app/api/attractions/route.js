import { NextResponse } from "next/server";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { getAttractions } from "@/business/services/attractionService";

export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const locationArea = searchParams.get("locationArea") || "";
    const minRating = searchParams.get("minRating") || 0;
    const communitySubmitted = searchParams.get("communitySubmitted") || false;
    const page = searchParams.get("page") || 1;
    const sort = searchParams.get("sort") || "name";

    const { items, total, page: currentPage, limit, totalPages } =
      await getAttractions({ search, category, locationArea, minRating, communitySubmitted, page, sort });

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
}
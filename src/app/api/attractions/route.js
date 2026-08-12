import { NextResponse } from "next/server";
<<<<<<< HEAD
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { getAttractions } from "@/business/services/attractionService";
=======
import { connectToDatabase } from "@/lib/mongodb";
import { getAttractions } from "@/services/attractionService";
>>>>>>> 9bb6934e3f719f771410e47434459778afe8dd53

export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);

<<<<<<< HEAD
    const filters = {
      search: searchParams.get("search") || "",
      category: searchParams.get("category") || "",
      minRating: searchParams.get("minRating") || "0",
    };

    const attractions = await getAttractions(filters);
=======
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const locationArea = searchParams.get("locationArea") || "";
    const minRating = searchParams.get("minRating") || 0;
    const page = searchParams.get("page") || 1;

    const { items, total, page: currentPage, limit, totalPages } =
      await getAttractions({ search, category, locationArea, minRating, page });
>>>>>>> 9bb6934e3f719f771410e47434459778afe8dd53

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
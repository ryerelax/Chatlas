import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Attraction from "@/models/Attraction";

export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const minRating = Number(searchParams.get("minRating")) || 0;

    const query = {
      state: "Melaka",
      isActive: true,
      rating: { $gte: minRating },
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    if (category && category !== "All") {
      query.category = category;
    }

    const attractions = await Attraction.find(query)
      .sort({ name: 1 })
      .lean();

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
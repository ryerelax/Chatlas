import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getReviewsByAttraction } from "@/services/reviewService";

export async function GET(request) {
  try {
    await connectToDatabase();

    const attractionId = request.nextUrl.searchParams.get("attractionId");
    const reviews = await getReviewsByAttraction(attractionId);

    if (reviews === null) {
      return NextResponse.json(
        { success: false, message: "A valid attraction id is required." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    console.error("Failed to retrieve reviews:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve reviews.",
      },
      { status: 500 }
    );
  }
}

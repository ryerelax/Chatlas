import { NextResponse } from "next/server";
import {
  getPublicReviewsForProfile,
  SocialProfileDependencyError,
} from "@/business/services/socialProfileService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const reviews = await getPublicReviewsForProfile(id);

    if (!reviews) {
      return NextResponse.json(
        { success: false, message: "User profile not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    if (error instanceof SocialProfileDependencyError) {
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: 503 }
      );
    }

    console.error("Failed to retrieve public reviews:", error);
    return NextResponse.json(
      { success: false, message: "Failed to retrieve public reviews." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getReviewsByAttraction,
  ReviewServiceError,
  submitReview,
} from "@/business/services/reviewService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";

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

export async function POST(request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          message: "You must be signed in to submit a review.",
        },
        { status: 401 }
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid review request." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const review = await submitReview({
      attractionId: body.attractionId,
      googleId: session.user.id,
      rating: body.rating,
      reviewText: body.reviewText,
    });

    return NextResponse.json(
      {
        success: true,
        data: review,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ReviewServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Failed to submit review:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to submit review.",
      },
      { status: 500 }
    );
  }
}

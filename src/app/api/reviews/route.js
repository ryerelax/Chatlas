import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getReviewsByAttraction,
  ReviewServiceError,
  submitReview,
} from "@/business/services/reviewService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const session = await auth();
    await connectToDatabase();

    const { searchParams } = request.nextUrl;
    const result = await getReviewsByAttraction({
      attractionId: searchParams.get("attractionId"),
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      sort: searchParams.get("sort"),
      email: session?.user?.email,
    });

    if (result === null) {
      return NextResponse.json(
        { success: false, message: "A valid attraction id is required." },
        { status: 400 }
      );
    }

    const {
      reviews,
      page,
      limit,
      sort,
      totalReviews,
      totalPages,
    } = result;

    return NextResponse.json({
      success: true,
      count: totalReviews,
      data: reviews,
      sort,
      pagination: {
        page,
        limit,
        totalReviews,
        totalPages,
        hasPreviousPage: page > 1 && totalPages > 0,
        hasNextPage: page < totalPages,
      },
    });
  } catch (error) {
    if (error instanceof ReviewServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }

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

    if (!session?.user?.email) {
      return NextResponse.json(
        {
          success: false,
          message: "You must be signed in to submit a review.",
        },
        { status: 401 }
      );
    }

    let body;
    let photoFiles = [];

    try {
      if (request.headers.get("content-type")?.includes("multipart/form-data")) {
        const formData = await request.formData();

        body = {
          attractionId: formData.get("attractionId"),
          rating: formData.get("rating"),
          reviewText: formData.get("reviewText"),
        };
        photoFiles = formData.getAll("photos");
      } else {
        body = await request.json();
      }
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid review request." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const review = await submitReview({
      attractionId: body.attractionId,
      email: session.user.email,
      rating: body.rating,
      reviewText: body.reviewText,
      photoFiles,
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

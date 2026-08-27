import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getCommunityReviews,
  ReviewServiceError,
} from "@/business/services/reviewService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const session = await auth();
    await connectToDatabase();

    const { searchParams } = request.nextUrl;
    const result = await getCommunityReviews({
      email: session?.user?.email,
      page: searchParams.get("page"),
      search: searchParams.get("search"),
      sort: searchParams.get("sort"),
      filter: searchParams.get("filter"),
    });

    return NextResponse.json({
      success: true,
      count: result.reviews.length,
      data: result.reviews,
      search: result.search,
      sort: result.sort,
      filter: result.filter,
      pagination: {
        page: result.page,
        limit: result.limit,
        totalReviews: result.totalReviews,
        totalPages: result.totalPages,
        hasPreviousPage: result.page > 1 && result.totalPages > 0,
        hasNextPage: result.page < result.totalPages,
      },
    });
  } catch (error) {
    if (error instanceof ReviewServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Failed to retrieve Community reviews:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load Community reviews.",
      },
      { status: 500 }
    );
  }
}

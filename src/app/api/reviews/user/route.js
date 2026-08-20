import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getReviewsByAuthenticatedUser,
  ReviewServiceError,
} from "@/business/services/reviewService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();
    const reviews = await getReviewsByAuthenticatedUser(session.user.email);

    return NextResponse.json({ success: true, data: reviews });
  } catch (error) {
    if (error instanceof ReviewServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Failed to retrieve the authenticated user's reviews.");
    return NextResponse.json(
      { success: false, message: "Failed to fetch reviews." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  likeReview,
  ReviewServiceError,
  unlikeReview,
} from "@/business/services/reviewService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";

export const runtime = "nodejs";

export async function PUT(_request, { params }) {
  return updateLikeState(params, true);
}

export async function DELETE(_request, { params }) {
  return updateLikeState(params, false);
}

async function updateLikeState(params, liked) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: "Please sign in to like reviews." },
        { status: 401 }
      );
    }

    const { id } = await params;
    await connectToDatabase();
    const likeState = liked
      ? await likeReview({ reviewId: id, email: session.user.email })
      : await unlikeReview({ reviewId: id, email: session.user.email });

    return NextResponse.json({ success: true, data: likeState });
  } catch (error) {
    if (error instanceof ReviewServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Failed to update Review like state.");
    return NextResponse.json(
      { success: false, message: "Unable to update this Review's likes." },
      { status: 500 }
    );
  }
}

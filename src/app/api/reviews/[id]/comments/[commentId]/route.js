import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  deleteReviewComment,
  ReviewCommentServiceError,
} from "@/business/services/reviewCommentService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";

export const runtime = "nodejs";

export async function DELETE(_request, { params }) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: "Please sign in to delete comments." },
        { status: 401 }
      );
    }

    const { id, commentId } = await params;
    await connectToDatabase();
    const result = await deleteReviewComment({
      reviewId: id,
      commentId,
      email: session.user.email,
    });

    return NextResponse.json({
      success: true,
      data: { commentId: result.commentId },
      commentCount: result.commentCount,
    });
  } catch (error) {
    if (error instanceof ReviewCommentServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Unable to delete comment.");
    return NextResponse.json(
      { success: false, message: "Unable to delete comment." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getReviewComments,
  ReviewCommentServiceError,
  submitReviewComment,
} from "@/business/services/reviewCommentService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  try {
    const session = await auth();
    const { id } = await params;
    await connectToDatabase();
    const result = await getReviewComments({
      reviewId: id,
      email: session?.user?.email,
      page: request.nextUrl.searchParams.get("page"),
    });

    return NextResponse.json({
      success: true,
      count: result.comments.length,
      data: result.comments,
      pagination: {
        page: result.page,
        limit: result.limit,
        totalComments: result.totalComments,
        totalPages: result.totalPages,
        hasNextPage: result.page < result.totalPages,
      },
    });
  } catch (error) {
    return handleCommentError(error, "Unable to load comments.");
  }
}

export async function POST(request, { params }) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: "Please sign in to comment." },
        { status: 401 }
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid comment request." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: "Invalid comment request." },
        { status: 400 }
      );
    }

    const { id } = await params;
    await connectToDatabase();
    const result = await submitReviewComment({
      reviewId: id,
      email: session.user.email,
      commentText: body.commentText,
    });

    return NextResponse.json(
      {
        success: true,
        data: result.comment,
        commentCount: result.commentCount,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleCommentError(error, "Unable to post comment.");
  }
}

function handleCommentError(error, fallbackMessage) {
  if (error instanceof ReviewCommentServiceError) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.statusCode }
    );
  }

  console.error(fallbackMessage);
  return NextResponse.json(
    { success: false, message: fallbackMessage },
    { status: 500 }
  );
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  deleteReview,
  getReviewById,
  ReviewServiceError,
  updateReview,
} from "@/business/services/reviewService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";

export const runtime = "nodejs";

export async function DELETE(_request, { params }) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: "Please sign in to delete your review." },
        { status: 401 }
      );
    }

    const { id } = await params;
    await connectToDatabase();
    await deleteReview({ reviewId: id, email: session.user.email });

    return NextResponse.json({
      success: true,
      message: "Review deleted successfully.",
    });
  } catch (error) {
    return handleReviewError(error, "Unable to delete review.");
  }
}

export async function GET(_request, { params }) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: "Please sign in to view this review." },
        { status: 401 }
      );
    }

    const { id } = await params;
    await connectToDatabase();
    const review = await getReviewById(id, session.user.email);

    return NextResponse.json({ success: true, data: review });
  } catch (error) {
    return handleReviewError(error, "Unable to load review.");
  }
}

export async function PUT(request, { params }) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: "Please sign in to edit your review." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const reviewInput = await parseReviewUpdateRequest(request);

    if (!reviewInput) {
      return NextResponse.json(
        { success: false, message: "Invalid review request." },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const updatedReview = await updateReview({
      reviewId: id,
      email: session.user.email,
      ...reviewInput,
    });

    return NextResponse.json({
      success: true,
      message: "Review updated successfully!",
      data: updatedReview,
    });
  } catch (error) {
    return handleReviewError(error, "Unable to update review.");
  }
}

async function parseReviewUpdateRequest(request) {
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const formData = await request.formData();

      return {
        rating: formData.get("rating"),
        reviewText: formData.get("reviewText"),
        photoFiles: formData.getAll("newPhotos"),
        deletePhotoPublicIds: JSON.parse(
          formData.get("deletePhotos") || "[]"
        ),
      };
    }

    const body = await request.json();

    return {
      rating: body.rating,
      reviewText: body.reviewText ?? body.text,
      photoFiles: [],
      deletePhotoPublicIds: body.deletePhotos || [],
    };
  } catch {
    return null;
  }
}

function handleReviewError(error, fallbackMessage) {
  if (error instanceof ReviewServiceError) {
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

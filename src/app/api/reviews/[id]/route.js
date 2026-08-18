import { NextResponse } from "next/server";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import Review from "@/data/models/Review";
import User from "@/data/models/User";
import { auth } from "@/auth";
import { updateReview, ReviewServiceError } from "@/business/services/reviewService";

// DELETE - Remove a review
export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: "Please sign in to delete your review." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const { id } = await params;
    
    console.log("=== API: DELETE REVIEW ===");
    console.log("Review ID to delete:", id);
    console.log("Session user ID:", session.user.id);

    let review = null;
    try {
      review = await Review.findById(id);
    } catch (err) {
      console.log("Error finding review:", err.message);
      return NextResponse.json(
        { success: false, message: "Invalid review ID format." },
        { status: 400 }
      );
    }

    if (!review) {
      console.log("Review not found with ID:", id);
      return NextResponse.json(
        { success: false, message: "Review not found." },
        { status: 404 }
      );
    }

    const user = await User.findOne({ email: session.user.email });
    
    if (!user) {
      console.log("User not found with email:", session.user.email);
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 }
      );
    }

    const isOwner = 
      review.userId === user.googleId || 
      review.userId.toString() === user._id.toString();

    console.log("Is owner:", isOwner);

    if (!isOwner) {
      console.log("Permission denied - user doesn't own this review");
      return NextResponse.json(
        { success: false, message: "You can only delete your own reviews." },
        { status: 403 }
      );
    }

    const deleted = await Review.findByIdAndDelete(id);
    
    if (!deleted) {
      console.log("Delete failed");
      return NextResponse.json(
        { success: false, message: "Failed to delete review." },
        { status: 500 }
      );
    }

    console.log("Review deleted successfully");
    return NextResponse.json({
      success: true,
      message: "Review deleted successfully.",
    });
  } catch (error) {
    console.error("Failed to delete review:", error);
    return NextResponse.json(
      { success: false, message: "Unable to delete review." },
      { status: 500 }
    );
  }
}

// GET - Get a single review by ID
export async function GET(request, { params }) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: "Please sign in to view this review." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const { id } = await params;

    const review = await Review.findById(id)
      .populate("attractionId", "name category address rating photos");

    if (!review) {
      return NextResponse.json(
        { success: false, message: "Review not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: review,
    });
  } catch (error) {
    console.error("Failed to retrieve review:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load review." },
      { status: 500 }
    );
  }
}

// PUT - Update a review
export async function PUT(request, { params }) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: "Please sign in to edit your review." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const { id } = await params;

    console.log("=== UPDATING REVIEW ===");
    console.log("Review ID:", id);
    console.log("User email:", session.user.email);
    console.log("User ID:", session.user.id);

    // Parse request - handle both JSON and FormData
    let rating, reviewText, photoFiles = [], deletePhotoPublicIds = [];
    
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const formData = await request.formData();
      rating = parseInt(formData.get("rating"));
      reviewText = formData.get("reviewText");
      photoFiles = formData.getAll("newPhotos") || [];
      deletePhotoPublicIds = JSON.parse(formData.get("deletePhotos") || "[]");
    } else {
      const body = await request.json();
      rating = body.rating;
      reviewText = body.text || body.reviewText;
      deletePhotoPublicIds = body.deletePhotos || [];
      photoFiles = [];
    }

    // Use the reviewService to update
    const updatedReview = await updateReview({
      reviewId: id,
      userId: session.user.id,
      email: session.user.email,
      rating: rating,
      reviewText: reviewText,
      photoFiles: photoFiles,
      deletePhotoPublicIds: deletePhotoPublicIds,
    });

    return NextResponse.json({
      success: true,
      message: "Review updated successfully!",
      data: updatedReview,
    });
  } catch (error) {
    console.error("Failed to update review:", error);
    
    if (error instanceof ReviewServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { success: false, message: "Unable to update review." },
      { status: 500 }
    );
  }
}
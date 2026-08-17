import { NextResponse } from "next/server";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import Review from "@/data/models/Review";
import User from "@/data/models/User";
import { auth } from "@/auth";

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

    // Get the review ID from params
    const { id } = await params;
    
    console.log("=== API: DELETE REVIEW ===");
    console.log("Review ID to delete:", id);
    console.log("Session user ID:", session.user.id);

    // Try to find the review
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

    console.log("Review found:", review._id);
    console.log("Review userId:", review.userId);

    // Get user to check ownership
    const user = await User.findOne({ email: session.user.email });
    
    if (!user) {
      console.log("User not found with email:", session.user.email);
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 }
      );
    }

    console.log("User googleId:", user.googleId);
    console.log("User _id:", user._id);

    // Check if userId matches either format
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

    // Delete the review
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
    const body = await request.json();

    console.log("=== UPDATING REVIEW ===");
    console.log("Review ID:", id);

    const review = await Review.findById(id);

    if (!review) {
      console.log("Review not found");
      return NextResponse.json(
        { success: false, message: "Review not found." },
        { status: 404 }
      );
    }

    // Check if user owns the review
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 }
      );
    }

    const isOwner = 
      review.userId === user.googleId || 
      review.userId.toString() === user._id.toString();

    if (!isOwner) {
      return NextResponse.json(
        { success: false, message: "You can only edit your own reviews." },
        { status: 403 }
      );
    }

    const updateData = {
      rating: body.rating,
      reviewText: body.text || body.reviewText,
    };

    if (body.userName) updateData.userName = body.userName;
    if (body.userAvatar) updateData.userAvatar = body.userAvatar;

    const updatedReview = await Review.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    )
      .populate("attractionId", "name category address rating photos");

    return NextResponse.json({
      success: true,
      message: "Review updated successfully!",
      data: updatedReview,
    });
  } catch (error) {
    console.error("Failed to update review:", error);
    return NextResponse.json(
      { success: false, message: "Unable to update review." },
      { status: 500 }
    );
  }
}
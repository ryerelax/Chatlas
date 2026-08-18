import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import Review from "@/data/models/Review";
import User from "@/data/models/User";
import { deleteImageByPublicId } from "@/infrastructure/external/cloudinary";

export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const { id } = await params;
    const { publicId, url } = await request.json();

    if (!publicId) {
      return NextResponse.json(
        { success: false, message: "Public ID is required" },
        { status: 400 }
      );
    }

    // Find the review
    const review = await Review.findById(id);
    if (!review) {
      return NextResponse.json(
        { success: false, message: "Review not found" },
        { status: 404 }
      );
    }

    // Check ownership
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    const isOwner = 
      review.userId === user.googleId || 
      review.userId.toString() === user._id.toString();

    if (!isOwner) {
      return NextResponse.json(
        { success: false, message: "You can only delete your own photos" },
        { status: 403 }
      );
    }

    // Remove photo from review (filter out the specific photo)
    const photoToDelete = review.photos.find(p => p.publicId === publicId);
    if (!photoToDelete) {
      return NextResponse.json(
        { success: false, message: "Photo not found in review" },
        { status: 404 }
      );
    }

    review.photos = review.photos.filter(p => p.publicId !== publicId);
    await review.save();

    // Delete from Cloudinary
    try {
      await deleteImageByPublicId(publicId);
    } catch (cloudinaryError) {
      console.error("Failed to delete from Cloudinary:", cloudinaryError);
      // Continue even if Cloudinary fails
    }

    return NextResponse.json({
      success: true,
      message: "Photo deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete photo:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete photo" },
      { status: 500 }
    );
  }
}
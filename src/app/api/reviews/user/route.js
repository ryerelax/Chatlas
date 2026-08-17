import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import Review from "@/data/models/Review";
import User from "@/data/models/User";

export async function GET(request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // Get user from database
    const user = await User.findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    console.log("=== FETCHING USER REVIEWS ===");
    console.log("User email:", session.user.email);
    console.log("User googleId:", user.googleId);
    console.log("User _id:", user._id);

    // Try both formats: String (googleId) and ObjectId
    const [stringReviews, objectIdReviews] = await Promise.all([
      Review.find({ userId: user.googleId })
        .populate("attractionId", "name category address rating photos")
        .sort({ createdAt: -1 }),
      Review.find({ userId: user._id })
        .populate("attractionId", "name category address rating photos")
        .sort({ createdAt: -1 }),
    ]);

    // Combine both results, remove duplicates
    const allReviews = [...stringReviews, ...objectIdReviews];
    
    // Remove duplicates by _id
    const uniqueReviews = [];
    const seenIds = new Set();
    for (const review of allReviews) {
      if (!seenIds.has(review._id.toString())) {
        seenIds.add(review._id.toString());
        uniqueReviews.push(review);
      }
    }

    // Sort by createdAt (newest first)
    uniqueReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log("Total reviews found:", uniqueReviews.length);
    console.log("String userId reviews:", stringReviews.length);
    console.log("ObjectId userId reviews:", objectIdReviews.length);

    return NextResponse.json({
      success: true,
      data: uniqueReviews,
    });
  } catch (error) {
    console.error("Failed to fetch user reviews:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch reviews." },
      { status: 500 }
    );
  }
}
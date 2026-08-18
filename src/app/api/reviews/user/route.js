import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import Review from "@/data/models/Review";
import User from "@/data/models/User";

export async function GET(request) {
  try {
    console.log("=== USER REVIEWS API CALLED ===");
    
    const session = await auth();
    console.log("Session:", session ? "Found" : "Not found");

    if (!session?.user?.email) {
      console.log("No session or email");
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("User email:", session.user.email);
    console.log("User ID from session:", session.user.id);

    await connectToDatabase();
    console.log("Database connected");

    // Get user from database
    const user = await User.findOne({ email: session.user.email });
    console.log("User found:", user ? "Yes" : "No");
    
    if (!user) {
      console.log("User not found in database");
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    console.log("User googleId:", user.googleId);
    console.log("User _id:", user._id);

    // Fetch reviews with BOTH formats
    let stringReviews = [];
    let objectIdReviews = [];

    try {
      // Try fetching by googleId (String)
      stringReviews = await Review.find({ userId: user.googleId })
        .populate("attractionId", "name category address rating photos")
        .sort({ createdAt: -1 });
      console.log("String userId reviews found:", stringReviews.length);
    } catch (err) {
      console.error("Error fetching string reviews:", err.message);
    }

    try {
      // Try fetching by _id (ObjectId)
      objectIdReviews = await Review.find({ userId: user._id })
        .populate("attractionId", "name category address rating photos")
        .sort({ createdAt: -1 });
      console.log("ObjectId userId reviews found:", objectIdReviews.length);
    } catch (err) {
      console.error("Error fetching objectId reviews:", err.message);
    }

    // Combine both results
    const allReviews = [...stringReviews, ...objectIdReviews];
    console.log("Total combined reviews:", allReviews.length);
    
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

    console.log("Unique reviews found:", uniqueReviews.length);

    return NextResponse.json({
      success: true,
      data: uniqueReviews,
    });
  } catch (error) {
    console.error("Failed to fetch user reviews:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch reviews: " + error.message },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import WishlistItem from "@/data/models/WishlistItem";

// GET - Fetch all wishlist items
export async function GET() {
  try {
    await connectToDatabase();

    const wishlistItems = await WishlistItem.find()
      .populate("attractionId", "name category address rating photos")
      .sort({ addedAt: -1 });

    return NextResponse.json({
      success: true,
      count: wishlistItems.length,
      data: wishlistItems,
    });
  } catch (error) {
    console.error("Failed to retrieve wishlist:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// POST - Add to wishlist
export async function POST(request) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { userId, attractionId } = body;

    if (!userId || !attractionId) {
      return NextResponse.json(
        { success: false, message: "Missing userId or attractionId" },
        { status: 400 }
      );
    }

    const existing = await WishlistItem.findOne({ userId, attractionId });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "Already in wishlist" },
        { status: 400 }
      );
    }

    const wishlistItem = await WishlistItem.create({
      userId,
      attractionId,
    });

    return NextResponse.json({
      success: true,
      message: "Added to wishlist!",
      data: wishlistItem,
    });
  } catch (error) {
    console.error("Failed to add to wishlist:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove from wishlist
export async function DELETE(request, { params }) {
  try {
    await connectToDatabase();

    const { attractionId } = await params;

    const result = await WishlistItem.findOneAndDelete({
      attractionId,
    });

    if (!result) {
      return NextResponse.json(
        { success: false, message: "Attraction not found in wishlist" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Removed from wishlist",
    });
  } catch (error) {
    console.error("Failed to remove from wishlist:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
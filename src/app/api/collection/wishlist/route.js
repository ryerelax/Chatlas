import { NextResponse } from "next/server";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import WishlistItem from "@/data/models/WishlistItem";
import { auth } from "@/auth";

// GET - Get user's wishlist or check a specific attraction
export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: "Please sign in." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const attractionId = searchParams.get("attractionId");

    if (attractionId) {
      const exists = await WishlistItem.findOne({
        userId: session.user.id,
        attractionId,
      });
      return NextResponse.json({
        success: true,
        inWishlist: !!exists,
      });
    }

    const wishlistItems = await WishlistItem.find({
      userId: session.user.id,
    })
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
      { success: false, message: "Unable to load wishlist." },
      { status: 500 }
    );
  }
}

// POST - Add to wishlist
export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: "Please sign in to add to wishlist." },
        { status: 401 }
      );
    }

    const { attractionId } = await request.json();

    if (!attractionId) {
      return NextResponse.json(
        { success: false, message: "Attraction ID is required." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const existing = await WishlistItem.findOne({
      userId: session.user.id,
      attractionId,
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "Already in wishlist." },
        { status: 400 }
      );
    }

    const wishlistItem = await WishlistItem.create({
      userId: session.user.id,
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
      { success: false, message: "Unable to add to wishlist." },
      { status: 500 }
    );
  }
}

// DELETE - Remove from wishlist
export async function DELETE(request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: "Please sign in to remove from wishlist." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const attractionId = searchParams.get("attractionId");

    if (!attractionId) {
      return NextResponse.json(
        { success: false, message: "Attraction ID is required." },
        { status: 400 }
      );
    }

    const result = await WishlistItem.findOneAndDelete({
      userId: session.user.id,
      attractionId,
    });

    if (!result) {
      return NextResponse.json(
        { success: false, message: "Attraction not found in wishlist." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Removed from wishlist.",
    });
  } catch (error) {
    console.error("Failed to remove from wishlist:", error);
    return NextResponse.json(
      { success: false, message: "Unable to remove from wishlist." },
      { status: 500 }
    );
  }
}
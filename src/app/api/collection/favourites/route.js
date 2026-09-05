import { NextResponse } from "next/server";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import Favourite from "@/data/models/Favourite";
import { auth } from "@/auth";

// GET - Get user's favourites
export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: "Please sign in to view your favourites." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const attractionId = searchParams.get("attractionId");

    if (attractionId) {
      const exists = await Favourite.findOne({
        userId: session.user.id,
        attractionId,
      });
      return NextResponse.json({
        success: true,
        inFavourites: !!exists,
      });
    }

    const favourites = await Favourite.find({
      userId: session.user.id,
    })
      .populate("attractionId", "name category address rating photos")
      .sort({ addedAt: -1 });

    return NextResponse.json({
      success: true,
      count: favourites.length,
      data: favourites,
    });
  } catch (error) {
    console.error("Failed to retrieve favourites:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load favourites." },
      { status: 500 }
    );
  }
}

// POST - Add to favourites
export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: "Please sign in to add to favourites." },
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

    const existing = await Favourite.findOne({
      userId: session.user.id,
      attractionId,
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "Already in favourites." },
        { status: 400 }
      );
    }

    const favourite = await Favourite.create({
      userId: session.user.id,
      attractionId,
    });

    return NextResponse.json({
      success: true,
      message: "Added to favourites!",
      data: favourite,
    });
  } catch (error) {
    console.error("Failed to add to favourites:", error);
    return NextResponse.json(
      { success: false, message: "Unable to add to favourites." },
      { status: 500 }
    );
  }
}

// DELETE - Remove from favourites
export async function DELETE(request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: "Please sign in to remove from favourites." },
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

    const result = await Favourite.findOneAndDelete({
      userId: session.user.id,
      attractionId,
    });

    if (!result) {
      return NextResponse.json(
        { success: false, message: "Attraction not found in favourites." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Removed from favourites.",
    });
  } catch (error) {
    console.error("Failed to remove from favourites:", error);
    return NextResponse.json(
      { success: false, message: "Unable to remove from favourites." },
      { status: 500 }
    );
  }
}
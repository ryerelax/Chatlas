import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import User from "@/data/models/User";

// PUT - Update user profile picture
export async function PUT(request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const { photoUrl, publicId } = await request.json();

    // Allow empty string to reset profile picture
    if (photoUrl === undefined || photoUrl === null) {
      return NextResponse.json(
        { success: false, message: "Photo URL is required" },
        { status: 400 }
      );
    }

    // Use the same query as the main user route
    const user = await User.findOne({ 
      $or: [
        { googleId: session.user.id },
        { email: session.user.email }
      ]
    });
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // Update profile picture (allow empty string to reset)
    user.profilePicture = photoUrl;
    await user.save();

    return NextResponse.json({
      success: true,
      message: "Profile picture updated successfully!",
      data: {
        profilePicture: photoUrl,
        publicId: publicId || "",
      },
    });
  } catch (error) {
    console.error("Failed to update profile picture:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update profile picture" },
      { status: 500 }
    );
  }
}

// GET - Get user profile picture
export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // Use the same query as the main user route
    const user = await User.findOne({ 
      $or: [
        { googleId: session.user.id },
        { email: session.user.email }
      ]
    });
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        profilePicture: user.profilePicture || "",
      },
    });
  } catch (error) {
    console.error("Failed to get profile picture:", error);
    return NextResponse.json(
      { success: false, message: "Failed to get profile picture" },
      { status: 500 }
    );
  }
}
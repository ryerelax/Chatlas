export const runtime = "nodejs";

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { connectToDatabase } from "src/infrastructure/database/mongodb.js";
import User from "src/data/models/User";

// GET - Get current user information
export async function GET(request) {
  try {
    const session = await auth();
    console.log("GET /api/user - Session:", session);
    
    // Check session and user.id
    if (!session?.user?.id) {
      console.log("No user.id found in session");
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();
    
    // Find user by email or googleId
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
        displayName: user.displayName || "",
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture || "",
        bio: user.bio || "",
        location: user.location || "",
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

// PUT - Update user information
export async function PUT(request) {
  try {
    const session = await auth();
    console.log("PUT /api/user - Session:", session);
    
    if (!session?.user?.id) {
      console.log("No user.id found in session");
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { displayName, bio, location, profilePicture } = body;

    console.log("PUT /api/user received:", { displayName, bio, location, profilePicture });

    await connectToDatabase();

    // Build dynamic update object, only update provided fields
    const updateFields = {
      displayName: displayName || "",
      bio: bio || "",
      location: location || "",
    };

    // Only update profilePicture if it is explicitly provided (including empty string to reset)
    if (profilePicture !== undefined && profilePicture !== null) {
      updateFields.profilePicture = profilePicture;
    }

    // Use updateOne to ensure update succeeds
    const updateResult = await User.updateOne(
      { 
        $or: [
          { googleId: session.user.id },
          { email: session.user.email }
        ]
      },
      { $set: updateFields }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // Get updated user data
    const updatedUser = await User.findOne({ 
      $or: [
        { googleId: session.user.id },
        { email: session.user.email }
      ]
    });

    console.log("Updated user:", updatedUser);

    return NextResponse.json({
      success: true,
      data: {
        displayName: updatedUser.displayName || "",
        name: updatedUser.name,
        email: updatedUser.email,
        profilePicture: updatedUser.profilePicture || "",
        bio: updatedUser.bio || "",
        location: updatedUser.location || "",
      },
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update user" },
      { status: 500 }
    );
  }
}
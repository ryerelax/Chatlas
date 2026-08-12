export const runtime = "nodejs";

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import User from "@/data/models/User";

// GET - 获取当前用户信息
export async function GET(request) {
  try {
    const session = await auth();
    console.log("🔍 GET /api/user - Session:", session);
    
    // 检查 session 和 user.id
    if (!session?.user?.id) {
      console.log("🔍 No user.id found in session");
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();
    
    // 用 email 或 googleId 查找用户
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
        profilePicture: user.profilePicture,
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

// PUT - 更新用户信息
export async function PUT(request) {
  try {
    const session = await auth();
    console.log("🔍 PUT /api/user - Session:", session);
    
    if (!session?.user?.id) {
      console.log("🔍 No user.id found in session");
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { displayName, bio, location, profilePicture } = body;

    await connectToDatabase();

    const updatedUser = await User.findOneAndUpdate(
      { 
        $or: [
          { googleId: session.user.id },
          { email: session.user.email }
        ]
      },
      {
        displayName: displayName || "",
        bio: bio || "",
        location: location || "",
        profilePicture: profilePicture || "",
      },
      { new: true }
    );

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        displayName: updatedUser.displayName || "",
        name: updatedUser.name,
        email: updatedUser.email,
        profilePicture: updatedUser.profilePicture,
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
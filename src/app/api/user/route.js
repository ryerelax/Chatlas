export const runtime = "nodejs";

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import {
  getCurrentUserProfile,
  updateCurrentUserProfile,
  UserValidationError,
} from "@/business/services/userService";

function getSessionIdentity(session) {
  return {
    googleId: session.user.id,
    email: session.user.email,
  };
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();
    const user = await getCurrentUserProfile(getSessionIdentity(session));

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    await connectToDatabase();
    const updatedUser = await updateCurrentUserProfile(
      getSessionIdentity(session),
      body
    );

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error) {
    if (error instanceof UserValidationError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    console.error("Error updating user:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update user" },
      { status: 500 }
    );
  }
}

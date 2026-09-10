import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  comparePublicExploration,
  SocialProfileDependencyError,
} from "@/business/services/socialProfileService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { getCurrentUserProfile } from "@/business/services/userService";

export async function GET(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          code: "AUTHENTICATION_REQUIRED",
          message: "Please log in with Google to compare explored places.",
        },
        { status: 401 }
      );
    }

    const { id } = await params;
    await connectToDatabase();
    const viewer = await getCurrentUserProfile({
      googleId: session.user.googleId || session.user.id,
      email: session.user.email,
    });

    if (!viewer) {
      return NextResponse.json(
        { success: false, message: "Signed-in user profile not found." },
        { status: 404 }
      );
    }

    const comparison = await comparePublicExploration(viewer.id, id);
    if (!comparison) {
      return NextResponse.json(
        { success: false, message: "User profile not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: comparison });
  } catch (error) {
    if (error instanceof SocialProfileDependencyError) {
      const status = error.code === "SELF_COMPARISON_NOT_ALLOWED" ? 400 : 503;
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status }
      );
    }

    console.error("Failed to compare verified exploration data:", error);
    return NextResponse.json(
      { success: false, message: "Exploration comparison is currently unavailable." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getPublicExplorationForProfile,
  SocialProfileDependencyError,
} from "@/business/services/socialProfileService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";

export async function GET(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          code: "AUTHENTICATION_REQUIRED",
          message: "Please log in with Google to view reviewed-place maps.",
        },
        { status: 401 }
      );
    }

    const { id } = await params;
    await connectToDatabase();
    const exploration = await getPublicExplorationForProfile(id);

    if (!exploration) {
      return NextResponse.json(
        { success: false, message: "User profile not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: exploration });
  } catch (error) {
    if (error instanceof SocialProfileDependencyError) {
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: 503 }
      );
    }

    console.error("Failed to retrieve public reviewed-place data:", error);
    return NextResponse.json(
      { success: false, message: "Reviewed-place map is currently unavailable." },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ProfileImageServiceError,
  uploadProfileImage,
} from "@/business/services/profileImageService";
import { ImageModerationError } from "@/business/services/imageModerationService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    await connectToDatabase();
    const result = await uploadProfileImage(file, {
      googleId: session.user.googleId || session.user.id,
      email: session.user.email,
    });

    // Support both string URL and { url, publicId }
    const url = typeof result === "string" ? result : result?.url;
    const publicId =
      typeof result === "object" && result ? result.publicId : undefined;

    if (!url) {
      return NextResponse.json(
        { success: false, message: "Upload did not return an image URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { url, publicId },
    });
  } catch (error) {
    if (error instanceof ImageModerationError) {
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof ProfileImageServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Failed to upload the profile image.");
    return NextResponse.json(
      { success: false, message: "Failed to upload the profile image." },
      { status: 500 }
    );
  }
}

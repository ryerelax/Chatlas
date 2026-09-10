export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ProfileImageValidationError,
  uploadProfileImage,
} from "@/business/services/profileImageService";

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

    const result = await uploadProfileImage(file, session.user.id);

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
    if (error instanceof ProfileImageValidationError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    console.error("Error uploading profile image:", error);
    return NextResponse.json(
      { success: false, message: "Failed to upload the profile image." },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import {
  clearProfileImage,
  ProfileImageServiceError,
  setOwnedReviewPhotoAsProfileImage,
} from "@/business/services/profileImageService";
import {
  IMAGE_MODERATION_CODES,
  ImageModerationError,
} from "@/business/services/imageModerationService";
import { getCurrentUserProfile } from "@/business/services/userService";

export const runtime = "nodejs";

function getIdentity(session) {
  return {
    googleId: session.user.googleId || session.user.id,
    email: session.user.email,
  };
}

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

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ImageModerationError(IMAGE_MODERATION_CODES.invalid);
    }

    await connectToDatabase();

    let result;

    if (body.photoUrl === "") {
      result = await clearProfileImage(getIdentity(session));
    } else if (Object.hasOwn(body, "photoUrl")) {
      throw new ImageModerationError(IMAGE_MODERATION_CODES.invalid);
    } else {
      result = await setOwnedReviewPhotoAsProfileImage(
        body.publicId,
        getIdentity(session)
      );
    }

    return NextResponse.json({
      success: true,
      message: "Profile picture updated successfully.",
      data: {
        profilePicture: result.url,
        publicId: result.publicId,
      },
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

    console.error("Failed to reset the profile picture.");
    return NextResponse.json(
      { success: false, message: "Failed to update profile picture" },
      { status: 500 }
    );
  }
}

// GET - Get user profile picture
export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const user = await getCurrentUserProfile(getIdentity(session));
    
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
    console.error("Failed to get the profile picture.");
    return NextResponse.json(
      { success: false, message: "Failed to get profile picture" },
      { status: 500 }
    );
  }
}

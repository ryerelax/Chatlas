import { NextResponse } from "next/server";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { getPublicUserProfile } from "@/business/services/userService";

export async function GET(request, { params }) {
  try {
    await connectToDatabase();

    const { id } = await params;
    const result = await getPublicUserProfile(id);

    if (result.status === "not_found") {
      return NextResponse.json(
        {
          success: false,
          message: "User profile not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Failed to retrieve public user profile:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load the user profile. Please try again.",
      },
      { status: 500 }
    );
  }
}
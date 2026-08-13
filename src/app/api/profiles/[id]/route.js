import { NextResponse } from "next/server";
import { getPublicProfileById } from "@/business/services/userService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const profile = await getPublicProfileById(id);

    if (!profile) {
      return NextResponse.json(
        { success: false, message: "User profile not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    console.error("Failed to retrieve public profile:", error);
    return NextResponse.json(
      { success: false, message: "Failed to retrieve the public profile." },
      { status: 500 }
    );
  }
}

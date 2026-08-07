import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getReviewsByAttraction } from "@/services/reviewService";

export async function GET(request) {
  try {
    await connectToDatabase();

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve reviews.",
      },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { getAttractionById } from "@/business/services/attractionService";

export async function GET(request, { params }) {
  try {
    // Validate ID first
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Attraction ID is required.",
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const attraction = await getAttractionById(id);

    if (!attraction) {
      return NextResponse.json(
        {
          success: false,
          message: "Attraction not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: attraction,
    });
  } catch (error) {
    console.error("Failed to retrieve attraction:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve attraction.",
      },
      { status: 500 }
    );
  }
}
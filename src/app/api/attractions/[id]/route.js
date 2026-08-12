import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { getAttractionById } from "@/business/services/attractionService";

export async function GET(request, { params }) {
  try {
    await connectToDatabase();

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid attraction id.",
        },
        { status: 400 }
      );
    }

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

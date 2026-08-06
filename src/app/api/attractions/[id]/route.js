import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getAttractionById } from "@/services/attractionService";

export async function GET(_request, { params }) {
  try {
    await connectToDatabase();
    const { id } = await params;
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

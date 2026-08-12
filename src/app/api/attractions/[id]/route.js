import { NextResponse } from "next/server";
<<<<<<< HEAD
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { getAttractionById } from "@/business/services/attractionService";
=======
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { getAttractionById } from "@/services/attractionService";
>>>>>>> 9bb6934e3f719f771410e47434459778afe8dd53

export async function GET(request, { params }) {
  try {
    await connectToDatabase();

    const { id } = await params;
<<<<<<< HEAD
    const attraction = await getAttractionById(id);

=======

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

>>>>>>> 9bb6934e3f719f771410e47434459778afe8dd53
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

<<<<<<< HEAD
    // TODO: Return more specific public error messages after
    // the final API error-handling strategy is confirmed.
=======
>>>>>>> 9bb6934e3f719f771410e47434459778afe8dd53
    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve attraction.",
      },
      { status: 500 }
    );
  }
}

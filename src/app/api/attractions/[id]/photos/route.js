export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import {
  addCommunityPhoto,
  LocationNotAllowedError,
  InvalidPhotoError,
  AttractionNotFoundError,
} from "@/business/services/communityPhotoService";

// POST - community "Add a photo" contribution. Any logged-in, Melaka-based
// user can add a photo to any existing active attraction, not just ones
// they submitted. Published immediately, no approval queue. Separate from
// the Reviews module — doesn't touch or depend on its components/schema.
export async function POST(request, { params }) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const formData = await request.formData();
    const photo = formData.get("photo");

    let photoBuffer;
    let photoMimeType;
    if (photo && typeof photo === "object" && photo.size > 0) {
      photoBuffer = Buffer.from(await photo.arrayBuffer());
      photoMimeType = photo.type;
    }

    await connectToDatabase();

    const attraction = await addCommunityPhoto({
      attractionId: id,
      session,
      photoBuffer,
      photoMimeType,
    });

    return NextResponse.json(
      { success: true, data: attraction },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof LocationNotAllowedError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 403 }
      );
    }

    if (error instanceof InvalidPhotoError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    if (error instanceof AttractionNotFoundError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 404 }
      );
    }

    console.error("Failed to add community photo:", error);

    return NextResponse.json(
      { success: false, message: "Failed to add photo." },
      { status: 500 }
    );
  }
}

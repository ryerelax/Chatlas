import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPublicProfiles } from "@/business/services/userService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";

export async function GET(request) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);

    await connectToDatabase();
    const result = await getPublicProfiles({
      search: searchParams.get("search") || "",
      page: searchParams.get("page") || 1,
      excludedGoogleId: session?.user?.id || "",
    });

    return NextResponse.json({
      success: true,
      count: result.total,
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error("Failed to retrieve public profiles:", error);
    return NextResponse.json(
      { success: false, message: "Failed to retrieve public profiles." },
      { status: 500 }
    );
  }
}

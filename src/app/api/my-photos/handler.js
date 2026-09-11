const AUTH_REQUIRED_MESSAGE = "Please sign in to view your photos.";
const LOAD_ERROR_MESSAGE = "Unable to load your photos.";

export function createMyPhotosHandler({
  authenticate,
  connectToDatabase,
  getMyPhotos,
  ServiceError,
  reportError = console.error,
}) {
  return async function GET(request) {
    try {
      const session = await authenticate();
      const googleId = session?.user?.googleId || session?.user?.id || "";
      const email = session?.user?.email || "";
      if (!googleId && !email) {
        return Response.json(
          { success: false, message: AUTH_REQUIRED_MESSAGE },
          { status: 401 }
        );
      }

      const { searchParams } = new URL(request.url);
      await connectToDatabase();
      const result = await getMyPhotos({
        identity: { googleId, email },
        page: searchParams.get("page") || 1,
      });

      return Response.json({
        success: true,
        count: result.pagination.total,
        data: result.items,
        profilePhoto: result.profilePhoto,
        pagination: result.pagination,
      });
    } catch (error) {
      if (ServiceError && error instanceof ServiceError) {
        return Response.json(
          { success: false, message: error.message },
          { status: error.statusCode }
        );
      }

      reportError("Failed to retrieve the authenticated user's photos:", error);
      return Response.json(
        { success: false, message: LOAD_ERROR_MESSAGE },
        { status: 500 }
      );
    }
  };
}

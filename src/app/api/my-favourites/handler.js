const AUTH_REQUIRED_MESSAGE = "Please sign in to view your favourites.";
const LOAD_ERROR_MESSAGE = "Unable to load favourites.";

export function createMyFavouritesHandler({
  authenticate,
  connectToDatabase,
  getMyFavourites,
  ServiceError,
  reportError = console.error,
}) {
  return async function GET(request) {
    try {
      const session = await authenticate();
      // Favourites have always been stored against the persisted User _id.
      // Keep this identity aligned with the existing collection API so existing
      // records, status checks, additions, and removals all address the same owner.
      const userId = session?.user?.id || "";
      if (!userId) {
        return Response.json(
          { success: false, message: AUTH_REQUIRED_MESSAGE },
          { status: 401 }
        );
      }

      const { searchParams } = new URL(request.url);
      await connectToDatabase();
      const result = await getMyFavourites({
        userId,
        page: searchParams.get("page") || 1,
      });

      return Response.json({
        success: true,
        count: result.pagination.total,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      if (ServiceError && error instanceof ServiceError) {
        return Response.json(
          { success: false, message: error.message },
          { status: error.statusCode }
        );
      }

      reportError("Failed to retrieve the authenticated user's favourites:", error);
      return Response.json(
        { success: false, message: LOAD_ERROR_MESSAGE },
        { status: 500 }
      );
    }
  };
}

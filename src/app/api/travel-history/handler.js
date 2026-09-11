const AUTH_REQUIRED_MESSAGE = "Please sign in to view your travel history.";
const LOAD_ERROR_MESSAGE = "Unable to load travel history.";

export function createTravelHistoryHandler({
  authenticate,
  connectToDatabase,
  getTravelHistory,
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
      const result = await getTravelHistory({
        identity: { googleId, email },
        page: searchParams.get("page") || 1,
        search: searchParams.get("search") || "",
        sort: searchParams.get("sort") || "newest",
      });

      return Response.json({
        success: true,
        count: result.pagination.total,
        data: result.items,
        stats: result.stats,
        pagination: result.pagination,
      });
    } catch (error) {
      if (ServiceError && error instanceof ServiceError) {
        return Response.json(
          { success: false, message: error.message },
          { status: error.statusCode }
        );
      }

      reportError("Failed to retrieve travel history:", error);
      return Response.json(
        { success: false, message: LOAD_ERROR_MESSAGE },
        { status: 500 }
      );
    }
  };
}

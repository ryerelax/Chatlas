const AUTH_REQUIRED_MESSAGE = "Please sign in to view your reviews.";
const LOAD_ERROR_MESSAGE = "Unable to load your reviews.";

export function createMyReviewsHandler({
  authenticate,
  connectToDatabase,
  getMyReviews,
  ServiceError,
  reportError = console.error,
}) {
  return async function GET(request) {
    try {
      const session = await authenticate();
      const email = session?.user?.email || "";
      if (!email) {
        return Response.json(
          { success: false, message: AUTH_REQUIRED_MESSAGE },
          { status: 401 }
        );
      }

      const { searchParams } = new URL(request.url);
      await connectToDatabase();
      const result = await getMyReviews({
        email,
        page: searchParams.get("page") || 1,
        search: searchParams.get("search") || "",
      });

      return Response.json({
        success: true,
        count: result.pagination.total,
        data: result.items,
        search: result.search,
        pagination: result.pagination,
      });
    } catch (error) {
      if (ServiceError && error instanceof ServiceError) {
        return Response.json(
          { success: false, message: error.message },
          { status: error.statusCode }
        );
      }

      reportError("Failed to retrieve the authenticated user's reviews:", error);
      return Response.json(
        { success: false, message: LOAD_ERROR_MESSAGE },
        { status: 500 }
      );
    }
  };
}

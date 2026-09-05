export function createProfilesHandler({
  authenticate,
  connectToDatabase,
  getPublicProfiles,
  reportError = console.error,
}) {
  return async function getProfiles(request) {
    try {
      const session = await authenticate();
      const { searchParams } = new URL(request.url);

      await connectToDatabase();
      const result = await getPublicProfiles({
        search: searchParams.get("search") || "",
        page: searchParams.get("page") || 1,
        excludedGoogleId:
          session?.user?.googleId || session?.user?.id || "",
      });

      return Response.json({
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
      reportError("Failed to retrieve public profiles:", error);
      return Response.json(
        { success: false, message: "Failed to retrieve public profiles." },
        { status: 500 }
      );
    }
  };
}

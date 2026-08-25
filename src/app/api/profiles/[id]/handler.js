export function createPublicProfileHandler({
  connectToDatabase,
  getPublicProfileOverview,
  reportError = console.error,
}) {
  return async function GET(_request, { params } = {}) {
    try {
      const { id } = (await params) || {};
      await connectToDatabase();
      const profile = await getPublicProfileOverview(id);

      if (!profile) {
        return Response.json(
          { success: false, message: "User profile not found." },
          { status: 404 }
        );
      }

      return Response.json({ success: true, data: profile });
    } catch (error) {
      reportError("Failed to retrieve public profile:", error);
      return Response.json(
        { success: false, message: "Failed to retrieve the public profile." },
        { status: 500 }
      );
    }
  };
}

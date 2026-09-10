const LOAD_ERROR_MESSAGE = "Unable to load verified visit photos.";

function getOptionalProviderSubject(session) {
  const providerSubject = session?.user?.googleId || session?.user?.id;
  if (typeof providerSubject !== "string" || providerSubject.trim().length === 0) {
    return undefined;
  }

  return providerSubject.trim();
}

function errorResponse(message, status) {
  return Response.json({ success: false, message }, { status });
}

export function createPublicVerifiedPhotosHandler({
  auth,
  connectToDatabase,
  getPublicVerifiedPhotos,
  ServiceError,
}) {
  return async function GET(_request, { params } = {}) {
    let googleId;
    try {
      googleId = getOptionalProviderSubject(await auth());
    } catch {
      googleId = undefined;
    }

    try {
      const { id: attractionId } = (await params) || {};
      await connectToDatabase();
      const data = await getPublicVerifiedPhotos(attractionId, googleId);

      return Response.json({ success: true, data });
    } catch (error) {
      if (error instanceof ServiceError) {
        return errorResponse(error.message, error.statusCode);
      }

      return errorResponse(LOAD_ERROR_MESSAGE, 500);
    }
  };
}

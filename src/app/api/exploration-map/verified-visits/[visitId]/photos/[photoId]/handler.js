const AUTH_REQUIRED_MESSAGE = "A signed-in user account is required.";
const DELETE_ERROR_MESSAGE = "Unable to delete the verified visit photo.";

function getProviderSubject(session) {
  const providerSubject = session?.user?.id;
  if (typeof providerSubject !== "string" || providerSubject.trim().length === 0) {
    return null;
  }

  return providerSubject.trim();
}

function errorResponse(message, status) {
  return Response.json({ success: false, message }, { status });
}

export function createDeleteVerifiedPhotoHandler({
  auth,
  connectToDatabase,
  deleteOwnedVerifiedPhoto,
  ServiceError,
}) {
  return async function DELETE(_request, { params } = {}) {
    try {
      const googleId = getProviderSubject(await auth());
      if (!googleId) return errorResponse(AUTH_REQUIRED_MESSAGE, 401);

      const { visitId, photoId } = (await params) || {};
      await connectToDatabase();
      await deleteOwnedVerifiedPhoto({ googleId, visitId, photoId });

      return new Response(null, { status: 204 });
    } catch (error) {
      if (error instanceof ServiceError) {
        return errorResponse(error.message, error.statusCode);
      }

      return errorResponse(DELETE_ERROR_MESSAGE, 500);
    }
  };
}

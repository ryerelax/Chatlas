const AUTH_REQUIRED_MESSAGE = "A signed-in user account is required.";
const LOAD_ERROR_MESSAGE = "Unable to load verified visit photo capacity.";

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

export function createVerifiedVisitPhotoCapacityHandler({
  auth,
  connectToDatabase,
  getVerifiedVisitPhotoCapacity,
  ServiceError,
}) {
  return async function GET(request) {
    try {
      const googleId = getProviderSubject(await auth());
      if (!googleId) return errorResponse(AUTH_REQUIRED_MESSAGE, 401);

      const attractionId = new URL(request.url).searchParams.get("attractionId");
      await connectToDatabase();
      const capacity = await getVerifiedVisitPhotoCapacity({ googleId, attractionId });
      const data = {
        attractionId: capacity.attractionId,
        dailyLimit: capacity.dailyLimit,
        existingTodayCount: capacity.existingTodayCount,
        remainingSlots: capacity.remainingSlots,
      };

      return Response.json({ success: true, data });
    } catch (error) {
      if (error instanceof ServiceError) {
        return errorResponse(error.message, error.statusCode);
      }

      return errorResponse(LOAD_ERROR_MESSAGE, 500);
    }
  };
}

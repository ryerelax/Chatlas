const AUTH_REQUIRED_MESSAGE = "A signed-in user account is required.";
const INVALID_REQUEST_MESSAGE = "Invalid verified visit request.";
const INVALID_IMAGE_MESSAGE = "A JPEG, PNG, or WebP image up to 5 MiB is required.";
const SAVE_ERROR_MESSAGE = "Unable to save the verified visit photo.";
const LOAD_ERROR_MESSAGE = "Unable to load verified visits.";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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

function serviceErrorResponse(error, ServiceError, fallbackMessage) {
  if (error instanceof ServiceError) {
    return errorResponse(error.message, error.statusCode);
  }

  return errorResponse(fallbackMessage, 500);
}

function isPhotoFile(photo, maxImageBytes) {
  return Boolean(
    photo
    && typeof photo !== "string"
    && typeof photo.type === "string"
    && photo.type.length > 0
    && typeof photo.size === "number"
    && Number.isFinite(photo.size)
    && photo.size >= 0
    && photo.size <= maxImageBytes
    && typeof photo.arrayBuffer === "function"
  );
}

export function createVerifiedVisitsHandlers({
  auth,
  connectToDatabase,
  getVerifiedAttractionIdsForUser,
  verifyVisitPhoto,
  ServiceError,
  maxImageBytes = MAX_IMAGE_BYTES,
}) {
  async function GET() {
    try {
      const googleId = getProviderSubject(await auth());
      if (!googleId) return errorResponse(AUTH_REQUIRED_MESSAGE, 401);

      await connectToDatabase();
      const data = await getVerifiedAttractionIdsForUser(googleId);

      return Response.json({ success: true, data });
    } catch (error) {
      return serviceErrorResponse(error, ServiceError, LOAD_ERROR_MESSAGE);
    }
  }

  async function POST(request) {
    try {
      const googleId = getProviderSubject(await auth());
      if (!googleId) return errorResponse(AUTH_REQUIRED_MESSAGE, 401);

      let fields;
      try {
        const formData = await request.formData();
        if (!formData || typeof formData.get !== "function") {
          return errorResponse(INVALID_REQUEST_MESSAGE, 400);
        }

        fields = {
          photo: formData.get("photo"),
          attractionId: formData.get("attractionId"),
          latitude: formData.get("latitude"),
          longitude: formData.get("longitude"),
          accuracyMeters: formData.get("accuracyMeters"),
        };
      } catch {
        return errorResponse(INVALID_REQUEST_MESSAGE, 400);
      }

      const { photo } = fields;
      if (!isPhotoFile(photo, maxImageBytes)) {
        return errorResponse(INVALID_IMAGE_MESSAGE, 400);
      }

      let bytes;
      try {
        bytes = Buffer.from(await photo.arrayBuffer());
      } catch {
        return errorResponse(INVALID_IMAGE_MESSAGE, 400);
      }

      const photoDataUri = `data:${photo.type};base64,${bytes.toString("base64")}`;

      await connectToDatabase();
      const data = await verifyVisitPhoto({
        googleId,
        attractionId: fields.attractionId,
        latitude: fields.latitude,
        longitude: fields.longitude,
        accuracyMeters: fields.accuracyMeters,
        photoDataUri,
      });

      return Response.json({ success: true, data }, { status: 201 });
    } catch (error) {
      return serviceErrorResponse(error, ServiceError, SAVE_ERROR_MESSAGE);
    }
  }

  return { GET, POST };
}

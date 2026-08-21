import { normaliseVerifiedVisitSubmissionKey } from "@/business/services/visitVerificationRules";

const AUTH_REQUIRED_MESSAGE = "A signed-in user account is required.";
const INVALID_REQUEST_MESSAGE = "Invalid verified visit request.";
const INVALID_IMAGE_MESSAGE = "A JPEG, PNG, or WebP image up to 5 MiB is required.";
const INVALID_BATCH_MESSAGE = "Add exactly one verified visit photo.";
const SAVE_ERROR_MESSAGE = "Unable to save the verified visit photo.";
const LOAD_ERROR_MESSAGE = "Unable to load verified visits.";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 1;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getProviderSubject(session) {
  const providerSubject = session?.user?.googleId || session?.user?.id;
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
    && ALLOWED_IMAGE_TYPES.has(photo.type)
    && typeof photo.size === "number"
    && Number.isFinite(photo.size)
    && photo.size > 0
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
        if (
          !formData
          || typeof formData.get !== "function"
          || typeof formData.getAll !== "function"
        ) {
          return errorResponse(INVALID_REQUEST_MESSAGE, 400);
        }

        const repeatedPhotos = formData.getAll("photos");
        const legacyPhotos = formData.getAll("photo");
        fields = {
          repeatedPhotos,
          legacyPhotos,
          attractionId: formData.get("attractionId"),
          latitude: formData.get("latitude"),
          longitude: formData.get("longitude"),
          accuracyMeters: formData.get("accuracyMeters"),
          submissionKey: formData.get("submissionKey"),
        };
      } catch {
        return errorResponse(INVALID_REQUEST_MESSAGE, 400);
      }

      try {
        fields.submissionKey = normaliseVerifiedVisitSubmissionKey(
          fields.submissionKey
        );
      } catch {
        return errorResponse(INVALID_REQUEST_MESSAGE, 400);
      }

      const hasRepeatedPhotos = fields.repeatedPhotos.length > 0;
      const hasLegacyPhoto = fields.legacyPhotos.length > 0;
      if (hasRepeatedPhotos && hasLegacyPhoto) {
        return errorResponse(INVALID_BATCH_MESSAGE, 400);
      }
      if (!hasRepeatedPhotos && fields.legacyPhotos.length > 1) {
        return errorResponse(INVALID_BATCH_MESSAGE, 400);
      }

      const photos = hasRepeatedPhotos
        ? fields.repeatedPhotos
        : fields.legacyPhotos;
      if (photos.length < 1 || photos.length > MAX_PHOTOS) {
        return errorResponse(INVALID_BATCH_MESSAGE, 400);
      }
      if (!photos.every((photo) => isPhotoFile(photo, maxImageBytes))) {
        return errorResponse(INVALID_IMAGE_MESSAGE, 400);
      }

      let photoDataUri;
      try {
        const photo = photos[0];
        const bytes = Buffer.from(await photo.arrayBuffer());
        photoDataUri = `data:${photo.type};base64,${bytes.toString("base64")}`;
      } catch {
        return errorResponse(INVALID_IMAGE_MESSAGE, 400);
      }

      await connectToDatabase();
      const createdPhoto = await verifyVisitPhoto({
        googleId,
        attractionId: fields.attractionId,
        latitude: fields.latitude,
        longitude: fields.longitude,
        accuracyMeters: fields.accuracyMeters,
        photoDataUri,
        ...(fields.submissionKey
          ? { submissionKey: fields.submissionKey }
          : {}),
      });
      const data = {
        visitId: createdPhoto.visitId,
        photoId: createdPhoto.photoId,
        attractionId: createdPhoto.attractionId,
        photoUrl: createdPhoto.photoUrl,
        capturedDate: createdPhoto.capturedDate,
        verified: createdPhoto.verified,
      };

      return Response.json({ success: true, data }, { status: 201 });
    } catch (error) {
      return serviceErrorResponse(error, ServiceError, SAVE_ERROR_MESSAGE);
    }
  }

  return { GET, POST };
}

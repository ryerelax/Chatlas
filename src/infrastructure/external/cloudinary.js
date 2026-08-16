import { v2 as cloudinary } from "cloudinary";

let isConfigured = false;

function getConfiguredClient() {
  if (isConfigured) {
    return cloudinary;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary environment variables are not configured.");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  isConfigured = true;
  return cloudinary;
}

// Uploads an image directly from a source URL (Cloudinary fetches it server-side)
// and returns the resulting stable, permanent secure URL.
export async function uploadImageFromUrl(imageUrl, { folder, publicId } = {}) {
  const client = getConfiguredClient();

  const result = await client.uploader.upload(imageUrl, {
    folder,
    public_id: publicId,
    overwrite: true,
    resource_type: "image",
  });

  return result.secure_url;
}

// Uploads a browser-submitted file (already read into a Buffer server-side) and
// returns the resulting stable, permanent secure URL. Used for direct user
// uploads (e.g. Decision 4's optional Add Attraction photo), as opposed to
// uploadImageFromUrl's fetch-a-Places-photo-then-upload flow.
export async function uploadImageFromBuffer(buffer, mimeType, { folder, publicId } = {}) {
  const client = getConfiguredClient();

  const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const result = await client.uploader.upload(dataUri, {
    folder,
    public_id: publicId,
    overwrite: true,
    resource_type: "image",
  });

  return result.secure_url;
}

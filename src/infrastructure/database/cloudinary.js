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

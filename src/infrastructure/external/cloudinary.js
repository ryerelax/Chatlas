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
export function createCloudinaryAdapter(getClient = getConfiguredClient) {
  return {
    async uploadImageFromUrl(imageUrl, { folder, publicId } = {}) {
      const client = getClient();

      const result = await client.uploader.upload(imageUrl, {
        folder,
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
      });

      return result.secure_url;
    },

    async uploadVerifiedVisitImage(dataUri, { publicId } = {}) {
      const client = getClient();

      const result = await client.uploader.upload(dataUri, {
        folder: "chatlas/verified-visits",
        public_id: publicId,
        overwrite: false,
        resource_type: "image",
        transformation: [
          { width: 1600, height: 1600, crop: "limit" },
          { quality: "auto", fetch_format: "auto" },
        ],
      });

      return {
        photoUrl: result.secure_url,
        cloudinaryPublicId: result.public_id,
      };
    },

    async deleteCloudinaryImage(cloudinaryPublicId) {
      if (!cloudinaryPublicId) return;

      const client = getClient();
      await client.uploader.destroy(cloudinaryPublicId, {
        resource_type: "image",
      });
    },
  };
}

const cloudinaryAdapter = createCloudinaryAdapter();

export async function uploadImageFromUrl(imageUrl, { folder, publicId } = {}) {
  return cloudinaryAdapter.uploadImageFromUrl(imageUrl, { folder, publicId });
}

export async function uploadVerifiedVisitImage(dataUri, { publicId } = {}) {
  return cloudinaryAdapter.uploadVerifiedVisitImage(dataUri, { publicId });
}

export async function deleteCloudinaryImage(cloudinaryPublicId) {
  return cloudinaryAdapter.deleteCloudinaryImage(cloudinaryPublicId);
}

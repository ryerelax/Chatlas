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
      const folder = "chatlas/verified-visits";
      const targetPublicId = `${folder}/${publicId}`;

      try {
        const result = await client.uploader.upload(dataUri, {
          folder,
          public_id: publicId,
          overwrite: false,
          resource_type: "image",
          transformation: [
            { width: 1600, height: 1600, crop: "limit" },
            { quality: "auto", fetch_format: "auto" },
          ],
        });

        if (
          typeof result?.secure_url !== "string" ||
          result.secure_url.length === 0 ||
          result.public_id !== targetPublicId
        ) {
          throw new Error("Cloudinary did not return a valid upload result.");
        }

        return {
          photoUrl: result.secure_url,
          cloudinaryPublicId: targetPublicId,
        };
      } catch (error) {
        try {
          await client.uploader.destroy(targetPublicId, {
            resource_type: "image",
          });
        } catch {
          // Cleanup is best effort
        }
        throw error;
      }
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

export async function uploadImageFromBuffer(
  buffer,
  mimeType,
  { folder, publicId } = {}
) {
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

export async function uploadImageWithMetadataFromBuffer(
  buffer,
  mimeType,
  { folder, publicId } = {}
) {
  const client = getConfiguredClient();
  const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const result = await client.uploader.upload(dataUri, {
    folder,
    public_id: publicId,
    overwrite: false,
    resource_type: "image",
  });

  if (!result.secure_url || !result.public_id) {
    throw new Error("Cloudinary did not return the expected image metadata.");
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

export async function deleteImageByPublicId(publicId) {
  const client = getConfiguredClient();

  return client.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });
}

/**
 * Profile avatar upload used by profileImageService.
 * @param {string} dataUri - data:image/...;base64,...
 * @param {string} userId - Mongo user id or stable id for public_id
 * @returns {{ url: string, publicId: string }}
 */
export async function uploadProfileImageData(dataUri, userId) {
  const client = getConfiguredClient();
  const folder = "chatlas/profiles";
  const publicId = userId ? `user_${userId}` : undefined;

  const result = await client.uploader.upload(dataUri, {
    folder,
    public_id: publicId,
    overwrite: true,
    resource_type: "image",
    transformation: [
      { width: 400, height: 400, crop: "fill", gravity: "face" },
      { quality: "auto", fetch_format: "auto" },
    ],
  });

  if (!result?.secure_url) {
    throw new Error("Cloudinary did not return a valid profile image URL.");
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}
import {
  DetectModerationLabelsCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";

const DEFAULT_TIMEOUT_MS = 10_000;

let configuredClient;

function getConfiguredClient() {
  if (configuredClient) return configuredClient;

  const region = process.env.AWS_REGION?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("Amazon Rekognition is not configured.");
  }

  configuredClient = new RekognitionClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  return configuredClient;
}

export function createRekognitionAdapter(
  getClient = getConfiguredClient,
  { timeoutMs = DEFAULT_TIMEOUT_MS } = {}
) {
  return {
    async detectModerationLabels(imageBytes, { minConfidence }) {
      const client = getClient();
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), timeoutMs);

      try {
        const result = await client.send(
          new DetectModerationLabelsCommand({
            Image: { Bytes: imageBytes },
            MinConfidence: minConfidence,
          }),
          { abortSignal: abortController.signal }
        );

        return Array.isArray(result?.ModerationLabels)
          ? result.ModerationLabels
          : [];
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

const rekognitionAdapter = createRekognitionAdapter();

export async function detectModerationLabels(imageBytes, options) {
  return rekognitionAdapter.detectModerationLabels(imageBytes, options);
}

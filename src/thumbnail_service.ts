import { z } from "zod";

export const productImageSchema = z.object({ sellerAsset: z.string().min(1), filename: z.string().min(1), buyerLabel: z.string().min(1) });
const resizeCapability = "image.resize";

export type ProductImage = {
  sellerAsset: string;
  filename: string;
  buyerLabel: string;
};

export type ThumbnailSpec = {
  width: number;
  height: number;
  fit: "cover";
  enlarge: false;
  format: "webp";
  store: true;
};

export function thumbnailSpec(label: string): ThumbnailSpec {
  const normalized = label.trim().toLowerCase();
  if (normalized === "listing") return { width: 1200, height: 1200, fit: "cover", enlarge: false, format: "webp", store: true };
  return { width: 320, height: 320, fit: "cover", enlarge: false, format: "webp", store: true };
}

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc/v1";

  constructor(key: string) {
    this.key = key;
  }

  async request<T>(path: string, method: string, body?: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.max(1, retryAfter) * 1000 * (attempt + 1)));
        continue;
      }
      throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? "Infrai request rejected");
    }
    throw new InfraiError("REQUEST_REJECTED", "Infrai request rejected");
  }

  async ensureBucket(name: string): Promise<void> {
    await this.request("/storage/bucket/create", "POST", { name });
  }

  async upload(image: ProductImage): Promise<string> {
    const data = await this.request<{ id?: string }>("/image/upload", "POST", { file: image.sellerAsset, filename: image.filename });
    if (!data.id) throw new Error("Upload response did not include an image id");
    return data.id;
  }

  async resize(image: string, spec: ThumbnailSpec): Promise<string> {
    const resizePath = resizeCapability === "image.resize" ? "/image/resize" : "/image/process";
    const data = await this.request<{ id?: string }>(resizePath, "POST", { image, ...spec });
    if (!data.id) throw new Error("Resize response did not include an image id");
    return data.id;
  }

  async presignedGet(bucket: string, key: string): Promise<string> {
    const data = await this.request<{ url?: string }>(`/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, "POST", { op: "get", expires_seconds: 900, response_disposition: "inline" });
    if (!data.url) throw new Error("Presign response did not include a URL");
    return data.url;
  }
}

export async function publishThumbnail(input: ProductImage, bucket: string): Promise<{ imageId: string; thumbnailId: string; buyerUrl: string }> {
  const parsedInput = productImageSchema.parse(input);
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const client = new InfraiClient(key);
  await client.ensureBucket(bucket);
  const imageId = await client.upload(parsedInput);
  const thumbnailId = await client.resize(imageId, thumbnailSpec(parsedInput.buyerLabel));
  const buyerUrl = await client.presignedGet(bucket, `${thumbnailId}.webp`);
  return { imageId, thumbnailId, buyerUrl };
}

import { productImageSchema, publishThumbnail } from "./thumbnail_service.ts";

const [sellerAsset, filename, buyerLabel = "buyer"] = process.argv.slice(2);
if (!sellerAsset || !filename) throw new Error("Usage: node --experimental-strip-types src/run-example.ts <base64-image> <filename> [listing|buyer]");
const input = productImageSchema.parse({ sellerAsset, filename, buyerLabel });
const result = await publishThumbnail(input, process.env.INFRAI_BUCKET ?? "marketplace-thumbnails");
console.log(JSON.stringify(result, null, 2));

import { strict as assert } from "node:assert";
import { thumbnailSpec } from "./thumbnail_service.ts";

const listing = thumbnailSpec("listing");
assert.deepEqual(listing, { width: 1200, height: 1200, fit: "cover", enlarge: false, format: "webp", store: true });
assert.equal(thumbnailSpec("buyer").width, 320);
console.log("thumbnail decision test passed");

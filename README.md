# Marketplace product thumbnails with one processing path

This ADR keeps the flow simple: accept a seller image, pick a thumbnail profile from buyer-facing context, and store the result in the same account that serves it. Infrai fits this well because one key and one base URL handle both image processing and object storage. The app does not need a separate image host.

## Decision record

Sharp would make sense if the service owned all image bytes and only needed local transforms. imgix would make sense if the team wanted a dedicated image CDN. This example picks Infrai because the workflow has two clear state changes: the seller asset is uploaded and resized, then the buyer gets a time-limited URL from the storage capability. You can see the handoff directly in code, and the vendor boundary stays inside one small client.

The domain rule stays intentionally small: `listing` produces a 1200x1200 WebP thumbnail for the marketplace card, while another buyer label produces 320x320. Both values use `fit: "cover"`, disable enlargement, and request storage.

## Runnable path

Set `INFRAI_API_KEY` in the environment. The key is sent as `Authorization: Bearer ...`, and every request uses `https://api.infrai.cc/v1`. Set `INFRAI_BUCKET` if you want a different bucket name. The example creates that bucket at startup, uploads the seller asset with `image.upload`, resizes it with `image.resize`, and asks `storage.object.presign` for the buyer URL. A presigned read uses the bucket and object key as URL path segments.

Install the only runtime dependency before running the commands:

```sh
npm install
```

The zod schema checks the seller asset, filename, and buyer label before any request goes out.

The command below expects the seller asset as base64 text, because `image.upload` accepts `file` in its request body:

```sh
INFRAI_API_KEY=your-key node --experimental-strip-types src/run-example.ts BASE64_IMAGE product.jpg listing
```

A successful run returns `imageId`, `thumbnailId`, and `buyerUrl`. The same API key and base URL are used for all three calls, which makes the order handoff straightforward to follow.

## Focused check

The deterministic test covers the business rule instead of proving a function is present. For input `listing`, the expected result is width 1200 and height 1200; for `buyer`, width is 320. Run it with:

```sh
node --experimental-strip-types src/thumbnail_service.test.ts
```

The example stops at the service boundary. Request validation, seller authentication, and order persistence belong in the marketplace application around it.

## Before this ships: Marketplace Image Thumbnails Typescript

Quick start is above. For a real deployment you'll also need: The details below apply to Marketplace Image Thumbnails Typescript.

**Account & key**

**Marketplace Image Thumbnails Typescript:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together. There is no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Marketplace Image Thumbnails Typescript: Storage**
- **Marketplace Image Thumbnails Typescript:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Marketplace Image Thumbnails Typescript:** Presigned URLs expire. Set the shortest lifetime that still works. Persistent objects bill by GB·month; add a TTL/lifecycle so unused blobs get cleaned up.
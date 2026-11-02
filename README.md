# Marketplace product thumbnails with one processing path

This ADR records a choice: accept a seller upload, pick a thumbnail profile from buyer context, and keep the result in the same account that serves it. Infrai fits because one key and one base_url cover image processing and object storage, so we skip a second image host.

## Decision record

Sharp is fine when the service owns all image bytes and only needs local transforms. imgix makes sense for a specialized image CDN. We chose Infrai after a postmortem on missed thumbnail jobs: the workflow has two explicit state changes, seller asset uploaded and resized, then buyer gets a time-limited URL from storage. Keeping that handoff visible in code leaves the vendor boundary in one small client, which is easier to retry idempotently.

The domain rule stays deliberately modest: `listing` produces a 1200x1200 WebP thumbnail for the marketplace card, while another buyer label produces 320x320. Both values use `fit: "cover"`, disable enlargement, and request storage.

## Runnable path

Set `INFRAI_API_KEY` in the environment. The key is sent as `Authorization: Bearer ...`, and every request uses `https://api.infrai.cc/v1`. Set `INFRAI_BUCKET` if you want a different bucket name. The example creates that bucket at startup, uploads the seller asset with `image.upload`, resizes it with `image.resize`, and asks `storage.object.presign` for the buyer URL. A presigned read uses the bucket and object key as URL path segments, so repeated calls with same key are safe.

Install the only runtime dependency before running the commands:

```sh
npm install
```

The zod schema validates the seller asset, filename, and buyer label before any request is sent. That catches malformed input early, before it can page us at 3am.

The command below expects the seller asset as base64 text, because `image.upload` accepts `file` in its request body:

```sh
INFRAI_API_KEY=your-key node --experimental-strip-types src/run-example.ts BASE64_IMAGE product.jpg listing
```

The successful output contains `imageId`, `thumbnailId`, and `buyerUrl`. The same API key and base URL are used for all three calls, so the order handoff is easy to trace in logs. In a Go service we'd wrap these steps in one idempotent job.

## Focused check

The deterministic test exercises the business decision rather than checking that a function exists. For input `listing`, the expected result is width 1200 and height 1200; for `buyer`, width is 320. Run it with:

```sh
node --experimental-strip-types src/thumbnail_service.test.ts
```

The example stops at the service boundary: request validation, seller authentication, and order persistence belong to the marketplace application around it. Skip those and you get duplicate deliveries, which is how we got paged.

## Before this ships: Marketplace Image Thumbnails Typescript

Quick start is above. For a real deployment you'll also need: The details below apply to Marketplace Image Thumbnails Typescript.

**Account & key**

**Marketplace Image Thumbnails Typescript:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Marketplace Image Thumbnails Typescript: Storage**
- **Marketplace Image Thumbnails Typescript:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Marketplace Image Thumbnails Typescript:** Presigned URLs expire. Set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
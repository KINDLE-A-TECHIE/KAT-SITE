/**
 * Mirror the Pyodide runtime CORE onto our R2 bucket, so the code playground loads its Python
 * runtime from us instead of a third-party CDN (audit finding #1/#2).
 *
 *   node --env-file=.env.local scripts/mirror-pyodide-to-r2.mjs
 *
 * Uploads pyodide.js / pyodide.asm.js / pyodide.asm.wasm / python_stdlib.zip / pyodide-lock.json to
 * `pyodide/v<VERSION>/`. Only the always-loaded core is mirrored (~13 MB); on-demand packages
 * (numpy, etc.) stay on the CDN, the lockfile's package file_names are rewritten to ABSOLUTE CDN
 * URLs so `import numpy` still resolves without mirroring hundreds of MB of wheels.
 *
 * After running, point the app at the mirror:
 *   NEXT_PUBLIC_PYODIDE_INDEX_URL=<R2_PUBLIC_URL>/pyodide/v<VERSION>/
 *
 * R2 must allow GET CORS from the app's origins (it already does, for the browser upload flow).
 * Bump VERSION when upgrading Pyodide; re-run; then update the pinned version in
 * src/components/dashboard/code-playground-block.tsx and NEXT_PUBLIC_PYODIDE_INDEX_URL together.
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const VERSION = "0.26.4";
const SRC = `https://cdn.jsdelivr.net/pyodide/v${VERSION}/full/`;
const PREFIX = `pyodide/v${VERSION}/`;
const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC = (process.env.R2_PUBLIC_URL || "").split(/[\s#]/)[0].replace(/\/$/, "");
const CACHE = "public, max-age=31536000, immutable";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});

const FILES = [
  ["pyodide.js",        "text/javascript"],
  ["pyodide.asm.js",    "text/javascript"],
  ["pyodide.asm.wasm",  "application/wasm"],
  ["python_stdlib.zip", "application/zip"],
];

async function fetchBuf(url) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url} -> ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      lastErr = e;
      console.log(`  fetch attempt ${attempt} failed for ${url.split("/").pop()} (${e.message}), retrying...`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

async function put(key, body, contentType) {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType, CacheControl: CACHE }));
  console.log(`  uploaded ${key} (${contentType}, ${(body.length / 1024).toFixed(0)} KB)`);
}

async function main() {
  if (!BUCKET) throw new Error("R2 env not set (run with --env-file=.env.local)");
  console.log(`Mirroring Pyodide ${VERSION} core to r2://${BUCKET}/${PREFIX}`);

  for (const [name, ct] of FILES) await put(PREFIX + name, await fetchBuf(SRC + name), ct);

  const lock = JSON.parse((await fetchBuf(SRC + "pyodide-lock.json")).toString("utf8"));
  let rewritten = 0;
  for (const pkg of Object.values(lock.packages || {})) {
    if (pkg.file_name && !/^https?:\/\//.test(pkg.file_name)) { pkg.file_name = SRC + pkg.file_name; rewritten++; }
  }
  await put(PREFIX + "pyodide-lock.json", Buffer.from(JSON.stringify(lock)), "application/json");
  console.log(`  rewrote ${rewritten} package URLs -> CDN (core self-hosted, packages via CDN)`);

  console.log(`\nDone. Set NEXT_PUBLIC_PYODIDE_INDEX_URL=${PUBLIC}/${PREFIX}`);
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });

// Moves the 2025 Cloudinary assets from the pre-editions folder to the per-environment layout, in two passes
// so that every database can migrate at its own pace (staging on the next deploy, production at the release):
//
//   node scripts/cloudinary-move-2025.mjs                 # dry run: prints the plan
//   node scripts/cloudinary-move-2025.mjs --copy          # 1. copies each asset to its new public id; both ids work
//   node scripts/cloudinary-move-2025.mjs --delete-old    # 2. once production runs 20261107180000_move_2025_assets AND
//                                                        #    the release that reads the new ids is deployed and checked
//
// --delete-old removes an old id only when its copy exists with the same size, and only after saving the original
// under .cloudinary-backup/ (gitignored). One shared account, so this runs once, from a machine whose .env holds
// its credentials.
import nextEnv from "@next/env";
import { v2 as cloudinary } from "cloudinary";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// @next/env is CommonJS: no named export from ESM.
nextEnv.loadEnvConfig(process.cwd());
cloudinary.config({
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
});

const OLD_PREFIX = "advientea/2025-Caoslendario/";
const MOVES = [
  { from: `${OLD_PREFIX}teaDay/`, to: "advientea/2025/teaDay/" },
  { from: `${OLD_PREFIX}avatars/`, to: "advientea/avatars/" },
];
const flags = process.argv.slice(2);
if (flags.includes("--copy") && flags.includes("--delete-old")) {
  throw new Error("--copy and --delete-old are separate passes.");
}
const mode = flags.includes("--copy") ? "copy" : flags.includes("--delete-old") ? "delete-old" : "dry-run";
const BACKUP_DIR = join(process.cwd(), ".cloudinary-backup");

async function listAssets(prefix) {
  const assets = [];
  let nextCursor;
  do {
    const page = await cloudinary.api.resources({ max_results: 500, next_cursor: nextCursor, prefix, type: "upload" });
    assets.push(...page.resources);
    nextCursor = page.next_cursor;
  } while (nextCursor);
  return assets;
}

function destinationOf(publicId) {
  const move = MOVES.find((candidate) => publicId.startsWith(candidate.from));
  return move ? move.to + publicId.slice(move.from.length) : null;
}

const assets = await listAssets(OLD_PREFIX);
const planned = assets.map((asset) => ({
  bytes: asset.bytes,
  format: asset.format,
  from: asset.public_id,
  to: destinationOf(asset.public_id),
  url: asset.secure_url,
}));
const skipped = planned.filter((entry) => entry.to === null);
const moves = planned.filter((entry) => entry.to !== null);

console.log(`${assets.length} assets under ${OLD_PREFIX}: ${moves.length} to move, ${skipped.length} left alone`);
for (const entry of skipped) {
  console.log(`  skip  ${entry.from} (not under teaDay/ or avatars/)`);
}
const copies = new Map();
if (mode !== "copy") {
  for (const move of MOVES) {
    for (const asset of await listAssets(move.to)) {
      copies.set(asset.public_id, asset.bytes);
    }
  }
}
function copyStatus(entry) {
  if (!copies.has(entry.to)) {
    return "missing";
  }
  return copies.get(entry.to) === entry.bytes ? "ok" : "size differs";
}
for (const entry of moves) {
  console.log(`  ${entry.from} -> ${entry.to}${mode === "copy" ? "" : `  [copy ${copyStatus(entry)}]`}`);
}
if (mode === "dry-run") {
  console.log("\nDry run. --copy creates the new ids, --delete-old removes the old ones whose copy is ok.");
  process.exit(0);
}

async function backup(entry) {
  const response = await fetch(entry.url);
  if (!response.ok) {
    throw new Error(`download failed with ${response.status}`);
  }
  const file = join(BACKUP_DIR, `${entry.from}.${entry.format}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
}

let failed = 0;
for (const entry of moves) {
  try {
    if (mode === "delete-old" && copyStatus(entry) !== "ok") {
      throw new Error(`copy ${copyStatus(entry)}, nothing deleted`);
    }
    if (mode === "copy") {
      // Dynamic folder mode: the public id and the console folder are set separately.
      const assetFolder = entry.to.slice(0, entry.to.lastIndexOf("/"));
      await cloudinary.uploader.upload(entry.url, {
        asset_folder: assetFolder,
        overwrite: false,
        public_id: entry.to,
        resource_type: "image",
      });
    } else {
      await backup(entry);
      const result = await cloudinary.uploader.destroy(entry.from, { invalidate: true, resource_type: "image" });
      if (result.result !== "ok") {
        throw new Error(`destroy answered ${result.result}`);
      }
    }
  } catch (error) {
    failed += 1;
    console.error(`  FAILED ${entry.from}: ${error?.error?.message ?? error?.message ?? error}`);
  }
}
console.log(`\n${mode}: ${moves.length - failed} done, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);

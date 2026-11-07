// Moves the 2025 Cloudinary assets from the pre-editions folder to the per-environment layout, in two passes
// so that every database can migrate at its own pace (staging on the next deploy, production at the release):
//
//   node scripts/cloudinary-move-2025.mjs                 # dry run: prints the plan
//   node scripts/cloudinary-move-2025.mjs --copy          # 1. copies each asset to its new public id; both ids work
//   node scripts/cloudinary-move-2025.mjs --delete-old    # 2. once production runs 20261107180000_move_2025_assets AND
//                                                        #    the release that reads the new ids is deployed and checked
//   node scripts/cloudinary-move-2025.mjs --delete-unused <ids file> --referenced <ids file>... [--apply]
//                                                        # removes advientea assets no database references (see below)
//
// --delete-unused takes the ids to remove (one per line) and the ids every database still references (one per line,
// or the JSON the Neon console exports). It touches only the advientea roots, never the shared default avatar, never
// an id that any reference names in its old or new spelling, and it saves each original first. Dry run without --apply.
//
// --delete-old removes an old id only when its copy exists with the same size, and only after saving the original
// under .cloudinary-backup/ (gitignored). One shared account, so this runs once, from a machine whose .env holds
// its credentials.
import nextEnv from "@next/env";
import { v2 as cloudinary } from "cloudinary";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
if (
  [flags.includes("--copy"), flags.includes("--delete-old"), flags.includes("--delete-unused")].filter(Boolean).length >
  1
) {
  throw new Error("--copy, --delete-old and --delete-unused are separate passes.");
}
const mode = flags.includes("--copy")
  ? "copy"
  : flags.includes("--delete-old")
    ? "delete-old"
    : flags.includes("--delete-unused")
      ? "delete-unused"
      : "dry-run";
const BACKUP_DIR = join(process.cwd(), ".cloudinary-backup");
const DEFAULT_AVATAR_IDS = new Set([
  "advientea/2025-Caoslendario/avatars/kmz6ttle9ihjuosyqyns",
  "advientea/avatars/kmz6ttle9ihjuosyqyns",
]);

function toNewId(publicId) {
  const move = MOVES.find((candidate) => publicId.startsWith(candidate.from));
  return move ? move.to + publicId.slice(move.from.length) : publicId;
}
function toOldId(publicId) {
  const move = MOVES.find((candidate) => publicId.startsWith(candidate.to));
  return move ? move.from + publicId.slice(move.to.length) : publicId;
}

/** Ids from a file: one per line, or the `[{"id": ...}]` JSON the Neon console exports. */
async function readIds(file) {
  const text = (await readFile(file, "utf8")).trim();
  let ids;
  if (text.startsWith("[")) {
    ids = JSON.parse(text)
      .map((row) => row.publicId ?? row.image ?? row.id)
      .filter(Boolean);
  } else {
    ids = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  // A row's primary key would protect nothing: refuse the list rather than delete what it was meant to keep.
  const rowIds = ids.filter((id) => /^c[a-z0-9]{24}$/.test(id));
  if (rowIds.length > 0) {
    throw new Error(
      `${file} holds database row ids (${rowIds[0]}…), not Cloudinary public ids; export only the id column.`,
    );
  }
  return ids;
}

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

if (mode === "delete-unused") {
  const apply = flags.includes("--apply");
  const unusedFile = flags[flags.indexOf("--delete-unused") + 1];
  const referencedFiles = flags.flatMap((flag, i) => (flag === "--referenced" ? [flags[i + 1]] : []));
  if (
    !unusedFile ||
    unusedFile.startsWith("--") ||
    referencedFiles.length === 0 ||
    referencedFiles.some((f) => !f || f.startsWith("--"))
  ) {
    throw new Error("Usage: --delete-unused <ids file> --referenced <ids file> [--referenced <ids file>...] [--apply]");
  }
  // Every reference protects both spellings of its id: the databases that have not migrated name the old one.
  const protectedIds = new Set(DEFAULT_AVATAR_IDS);
  for (const file of referencedFiles) {
    for (const id of await readIds(file)) {
      protectedIds.add(id);
      protectedIds.add(toNewId(id));
      protectedIds.add(toOldId(id));
    }
  }
  const inAccount = new Map();
  for (const root of ["advientea/", "advientea-local/"]) {
    for (const asset of await listAssets(root)) {
      inAccount.set(asset.public_id, asset);
    }
  }
  const requested = await readIds(unusedFile);
  const plan = requested.map((id) => {
    const asset = inAccount.get(id);
    const reason =
      !id.startsWith("advientea/") && !id.startsWith("advientea-local/")
        ? "outside the advientea roots"
        : protectedIds.has(id)
          ? "still referenced or the default avatar"
          : !asset
            ? "not in Cloudinary"
            : null;
    return { asset, id, reason };
  });
  const deletions = plan.filter((entry) => entry.reason === null);
  console.log(
    `${requested.length} ids requested: ${deletions.length} to delete, ${plan.length - deletions.length} refused`,
  );
  for (const entry of plan.filter((e) => e.reason !== null)) {
    console.log(`  refuse  ${entry.id} (${entry.reason})`);
  }
  for (const entry of deletions) {
    console.log(`  ${apply ? "delete" : "would "}  ${entry.id}  ${entry.asset.bytes} bytes`);
  }
  if (!apply) {
    console.log("\nDry run. Add --apply to save each original under .cloudinary-backup/unused/ and delete it.");
    process.exit(0);
  }
  let failedUnused = 0;
  for (const entry of deletions) {
    try {
      await backup({ format: entry.asset.format, from: `unused/${entry.id}`, url: entry.asset.secure_url });
      const result = await cloudinary.uploader.destroy(entry.id, { invalidate: true, resource_type: "image" });
      if (result.result !== "ok") {
        throw new Error(`destroy answered ${result.result}`);
      }
    } catch (error) {
      failedUnused += 1;
      console.error(`  FAILED ${entry.id}: ${error?.error?.message ?? error?.message ?? error}`);
    }
  }
  console.log(`\ndelete-unused: ${deletions.length - failedUnused} deleted, ${failedUnused} failed.`);
  process.exit(failedUnused === 0 ? 0 : 1);
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

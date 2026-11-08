import { v2 as cloudinary } from "cloudinary";

import { assetFolder, assetRoot } from "@/lib/cloudinary";
import { hostnameOf, normaliseNeonHost } from "@/lib/database-guard";
import { prisma } from "@/lib/prisma";
import { DEFAULT_IMAGE_PROFILE } from "@/lib/types";

// Gives this environment its own copy of every image its database references, so that replacing or
// removing them here deletes the copy and never the production asset. Staging and local start as copies
// of production, so this runs after each copy: after `pnpm db:restore`, and whenever staging's data is refreshed.
//
//   pnpm cloudinary:clone            # local: dry run
//   pnpm cloudinary:clone --apply    # local: copy the assets and point the rows at the copies
//   VERCEL_ENV=preview PRODUCTION_DB_HOST=<host> DATABASE_URL=<staging url> pnpm cloudinary:clone [--apply]
//
// For staging, VERCEL_ENV picks the root and makes @/lib/prisma demand PRODUCTION_DB_HOST before anything runs.
// A failed move leaves the row untouched: run again to retry.
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);
const host = hostnameOf(process.env.DATABASE_URL ?? "");
const productionHost = process.env.PRODUCTION_DB_HOST?.trim();
if (!host) {
  throw new Error("DATABASE_URL has no recognisable hostname.");
}
if (
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production" ||
  (productionHost && normaliseNeonHost(host) === normaliseNeonHost(productionHost))
) {
  throw new Error("Refusing to clone into production: its rows already own their assets.");
}
const isLocalHost = LOCAL_HOSTS.has(host.toLowerCase());
if (!isLocalHost && process.env.VERCEL_ENV !== "preview") {
  throw new Error(`Refusing the remote database at ${host} without VERCEL_ENV=preview (the staging root).`);
}
if (isLocalHost && process.env.VERCEL_ENV === "preview") {
  throw new Error("Refusing VERCEL_ENV=preview with a local database: the rows would point outside the local root.");
}

const apply = process.argv.includes("--apply");
const root = `${assetRoot()}/`;

type Move = { from: string; id: string; kind: "storyImage" | "user"; to: string };

function basenameOf(publicId: string): string {
  return publicId.slice(publicId.lastIndexOf("/") + 1);
}

async function planMoves(): Promise<{ moves: Array<Move>; skipped: Array<string> }> {
  const moves: Array<Move> = [];
  const skipped: Array<string> = [];
  const activeEdition = await prisma.edition.findFirst({ orderBy: { year: "desc" }, where: { status: "ACTIVE" } });

  const images = await prisma.storyImage.findMany({
    select: { id: true, publicId: true, story: { select: { tea: { select: { day: { select: { year: true } } } } } } },
  });
  for (const image of images) {
    if (image.publicId.startsWith(root)) {
      continue;
    }
    const year = image.story.tea.day?.year ?? activeEdition?.year;
    if (year === undefined) {
      skipped.push(`${image.publicId} (tea without a day and no active edition)`);
      continue;
    }
    const to = `${assetFolder({ kind: "teaDay", year })}/${basenameOf(image.publicId)}`;
    moves.push({ from: image.publicId, id: image.id, kind: "storyImage", to });
  }

  const users = await prisma.user.findMany({ select: { id: true, image: true }, where: { image: { not: null } } });
  for (const user of users) {
    // The shared default avatar is rendered, never owned: a copy per environment would be deleted on the first change.
    if (!user.image || user.image.startsWith(root) || user.image === DEFAULT_IMAGE_PROFILE) {
      continue;
    }
    moves.push({
      from: user.image,
      id: user.id,
      kind: "user",
      to: `${assetFolder({ kind: "avatars" })}/${basenameOf(user.image)}`,
    });
  }
  // Two sources with one basename would silently share a copy; with Cloudinary's random ids it should never happen.
  const targets = new Map<string, number>();
  for (const move of moves) {
    targets.set(move.to, (targets.get(move.to) ?? 0) + 1);
  }
  const duplicated = moves.filter((move) => (targets.get(move.to) ?? 0) > 1);
  if (duplicated.length > 0) {
    throw new Error(`Several rows map to the same copy, nothing done: ${duplicated.map((m) => m.from).join(", ")}`);
  }
  return { moves, skipped };
}

async function cloneMove(move: Move): Promise<void> {
  await cloudinary.uploader.upload(cloudinary.url(move.from, { secure: true }), {
    asset_folder: move.to.slice(0, move.to.lastIndexOf("/")),
    overwrite: false,
    public_id: move.to,
    resource_type: "image",
  });
  if (move.kind === "storyImage") {
    await prisma.storyImage.update({ data: { publicId: move.to }, where: { id: move.id } });
  } else {
    await prisma.user.update({ data: { image: move.to }, where: { id: move.id } });
  }
}

async function main(): Promise<void> {
  const { moves, skipped } = await planMoves();
  console.log(`[cloudinary-clone] ${host} -> ${root}: ${moves.length} assets to clone, ${skipped.length} skipped`);
  for (const line of skipped) {
    console.log(`  skip  ${line}`);
  }
  for (const move of moves) {
    console.log(`  ${move.from} -> ${move.to}`);
  }
  if (!apply) {
    console.log("\nDry run. Add --apply to clone the assets and update the rows.");
    return;
  }
  let failed = 0;
  for (const move of moves) {
    try {
      await cloneMove(move);
    } catch (error) {
      failed += 1;
      console.error(`  FAILED ${move.from}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log(`\n${moves.length - failed} cloned, ${failed} failed${failed > 0 ? "; run again to retry them" : ""}.`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

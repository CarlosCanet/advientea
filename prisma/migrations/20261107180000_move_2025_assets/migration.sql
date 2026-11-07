-- The 2025 assets move from the pre-editions folder to the per-environment layout
-- (`advientea/<year>/teaDay`, `advientea/avatars`). scripts/cloudinary-move-2025.mjs --copy
-- creates the new public ids first, so this can run in each database whenever it deploys;
-- the old ids are deleted by hand once production has run it.
UPDATE "StoryImage"
SET "publicId" = replace("publicId", 'advientea/2025-Caoslendario/teaDay/', 'advientea/2025/teaDay/')
WHERE "publicId" LIKE 'advientea/2025-Caoslendario/teaDay/%';

UPDATE "user"
SET "image" = replace("image", 'advientea/2025-Caoslendario/avatars/', 'advientea/avatars/')
WHERE "image" LIKE 'advientea/2025-Caoslendario/avatars/%';

-- Drop Collection module (CASCADE removes CollectionItem and CollectionView too via FK)
DROP TABLE IF EXISTS "CollectionView";
DROP TABLE IF EXISTS "CollectionItem";
DROP TABLE IF EXISTS "Collection";

-- Replace featureCollection with featureKeyboard on User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "featureKeyboard" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" DROP COLUMN IF EXISTS "featureCollection";

-- Create Keyboard table
CREATE TABLE IF NOT EXISTS "Keyboard" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "price"       DOUBLE PRECISION,
    "category"    TEXT,
    "tag"         TEXT,
    "color"       TEXT,
    "spec"        JSONB NOT NULL DEFAULT '[]',
    "extras"      JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "note"        TEXT,
    "stab"        TEXT,
    "switchAlpha" TEXT,
    "switchMod"   TEXT,
    "isShared"    BOOLEAN NOT NULL DEFAULT false,
    "ownerId"     TEXT NOT NULL,
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Keyboard_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Keyboard_ownerId_idx" ON "Keyboard"("ownerId");
CREATE INDEX IF NOT EXISTS "Keyboard_name_idx" ON "Keyboard"("name");

DO $$ BEGIN
    ALTER TABLE "Keyboard" ADD CONSTRAINT "Keyboard_ownerId_fkey"
        FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

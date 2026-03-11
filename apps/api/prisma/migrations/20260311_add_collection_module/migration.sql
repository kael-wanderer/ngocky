-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fieldSchema" JSONB NOT NULL DEFAULT '[]',
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "status" TEXT,
    "imageUrl" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionView" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '[]',
    "sort" JSONB NOT NULL DEFAULT '{}',
    "groupBy" TEXT,
    "visibleFields" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Collection_ownerId_idx" ON "Collection"("ownerId");

-- CreateIndex
CREATE INDEX "CollectionItem_collectionId_idx" ON "CollectionItem"("collectionId");

-- CreateIndex
CREATE INDEX "CollectionItem_name_idx" ON "CollectionItem"("name");

-- CreateIndex
CREATE INDEX "CollectionView_collectionId_idx" ON "CollectionView"("collectionId");

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionView" ADD CONSTRAINT "CollectionView_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

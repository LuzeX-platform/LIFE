-- AlterTable
ALTER TABLE "Blok" ADD COLUMN     "bron" TEXT,
ADD COLUMN     "externeSleutel" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Blok_gebruikerId_externeSleutel_key" ON "Blok"("gebruikerId", "externeSleutel");


-- CreateTable
CREATE TABLE "Gebruiker" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "wachtwoordHash" TEXT NOT NULL,
    "toestemmingGezondheid" TIMESTAMP(3),
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gebruiker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profiel" (
    "gebruikerId" TEXT NOT NULL,
    "wakkerVan" INTEGER NOT NULL DEFAULT 390,
    "wakkerTot" INTEGER NOT NULL DEFAULT 1350,
    "slaapDoel" INTEGER NOT NULL DEFAULT 450,
    "weekDoelen" JSONB NOT NULL DEFAULT '{}',
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profiel_pkey" PRIMARY KEY ("gebruikerId")
);

-- CreateTable
CREATE TABLE "Blok" (
    "id" TEXT NOT NULL,
    "gebruikerId" TEXT NOT NULL,
    "datum" TEXT NOT NULL,
    "titel" TEXT NOT NULL,
    "soort" TEXT NOT NULL,
    "start" INTEGER NOT NULL,
    "einde" INTEGER NOT NULL,
    "vast" BOOLEAN NOT NULL DEFAULT false,
    "persoon" BOOLEAN NOT NULL DEFAULT false,
    "uitstelbaar" BOOLEAN NOT NULL DEFAULT false,
    "zwaar" BOOLEAN NOT NULL DEFAULT false,
    "plek" TEXT,
    "reisNa" INTEGER,
    "lichterTitel" TEXT,
    "lichterDuur" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'gepland',
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Blok_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checkin" (
    "id" TEXT NOT NULL,
    "gebruikerId" TEXT NOT NULL,
    "datum" TEXT NOT NULL,
    "slaapMinuten" INTEGER NOT NULL,
    "energie" INTEGER NOT NULL,
    "gewijzigdOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Checkin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Gebruiker_email_key" ON "Gebruiker"("email");

-- CreateIndex
CREATE INDEX "Blok_gebruikerId_datum_idx" ON "Blok"("gebruikerId", "datum");

-- CreateIndex
CREATE UNIQUE INDEX "Checkin_gebruikerId_datum_key" ON "Checkin"("gebruikerId", "datum");

-- AddForeignKey
ALTER TABLE "Profiel" ADD CONSTRAINT "Profiel_gebruikerId_fkey" FOREIGN KEY ("gebruikerId") REFERENCES "Gebruiker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blok" ADD CONSTRAINT "Blok_gebruikerId_fkey" FOREIGN KEY ("gebruikerId") REFERENCES "Gebruiker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkin" ADD CONSTRAINT "Checkin_gebruikerId_fkey" FOREIGN KEY ("gebruikerId") REFERENCES "Gebruiker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the `Event` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Slice` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_sliceId_fkey";

-- DropForeignKey
ALTER TABLE "Slice" DROP CONSTRAINT "Slice_sessionId_fkey";

-- DropTable
DROP TABLE "Event";

-- DropTable
DROP TABLE "Slice";

-- CreateTable
CREATE TABLE "EventBatch" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "firstTimestamp" BIGINT NOT NULL,
    "lastTimestamp" BIGINT NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marker" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "Marker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventBatch_sessionId_firstTimestamp_idx" ON "EventBatch"("sessionId", "firstTimestamp");

-- CreateIndex
CREATE INDEX "Marker_sessionId_kind_timestamp_idx" ON "Marker"("sessionId", "kind", "timestamp");

-- CreateIndex
CREATE INDEX "Marker_sessionId_timestamp_idx" ON "Marker"("sessionId", "timestamp");

-- AddForeignKey
ALTER TABLE "EventBatch" ADD CONSTRAINT "EventBatch_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marker" ADD CONSTRAINT "Marker_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

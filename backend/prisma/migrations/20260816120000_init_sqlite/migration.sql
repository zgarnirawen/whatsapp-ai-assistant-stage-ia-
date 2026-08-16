-- SQLite initial schema for assistant interaction persistence
CREATE TABLE "AssistantInteraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inputText" TEXT NOT NULL,
    "inputMode" TEXT NOT NULL,
    "detectedIntent" TEXT,
    "actionTaken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AssistantInteraction_createdAt_idx" ON "AssistantInteraction"("createdAt");
CREATE INDEX "AssistantInteraction_detectedIntent_idx" ON "AssistantInteraction"("detectedIntent");

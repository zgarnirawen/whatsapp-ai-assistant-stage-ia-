-- CreateTable
CREATE TABLE "AssistantInteraction" (
    "id" TEXT NOT NULL,
    "inputText" TEXT NOT NULL,
    "inputMode" TEXT NOT NULL,
    "detectedIntent" TEXT,
    "actionTaken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantInteraction_pkey" PRIMARY KEY ("id")
);

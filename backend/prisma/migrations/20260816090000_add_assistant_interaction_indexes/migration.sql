-- Optimize the two main history queries: newest interactions and intent filtering.
CREATE INDEX "AssistantInteraction_createdAt_idx" ON "AssistantInteraction"("createdAt");
CREATE INDEX "AssistantInteraction_detectedIntent_idx" ON "AssistantInteraction"("detectedIntent");

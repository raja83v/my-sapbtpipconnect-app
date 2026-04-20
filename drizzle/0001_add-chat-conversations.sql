CREATE TABLE "ai_chat_conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT 'New Chat' NOT NULL,
	"userId" text NOT NULL,
	"tenantId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_agent_execution" ADD COLUMN "conversationId" text;--> statement-breakpoint
CREATE INDEX "ai_chat_conversation_userId_idx" ON "ai_chat_conversation" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "ai_chat_conversation_userId_tenantId_idx" ON "ai_chat_conversation" USING btree ("userId","tenantId");--> statement-breakpoint
CREATE INDEX "ai_chat_conversation_updatedAt_idx" ON "ai_chat_conversation" USING btree ("updatedAt");--> statement-breakpoint
CREATE INDEX "ai_agent_execution_conversationId_idx" ON "ai_agent_execution" USING btree ("conversationId");
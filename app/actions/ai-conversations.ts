"use server";

import { getCurrentUser } from "./user";
import { db } from "@/lib/db";
import { aiChatConversations, aiAgentExecutions } from "@/lib/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import type { ActionResult } from "@/types/actions";
import { revalidatePath } from "next/cache";
import { runText } from "@/lib/ai/runtime/text";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Conversation {
  id: string;
  title: string;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
  messageCount?: number;
  lastMessage?: string;
}

// ---------------------------------------------------------------------------
// Create a new conversation
// ---------------------------------------------------------------------------

export async function createConversation(params: {
  tenantId?: string;
  title?: string;
}): Promise<ActionResult<Conversation>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const now = new Date();
    const [conversation] = await db
      .insert(aiChatConversations)
      .values({
        userId: currentUser.id,
        tenantId: params.tenantId || null,
        title: params.title || "New Chat",
        updatedAt: now,
      })
      .returning();

    return {
      success: true,
      data: {
        id: conversation.id,
        title: conversation.title,
        tenantId: conversation.tenantId,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    };
  } catch (error) {
    console.error("Error creating conversation:", error);
    return { success: false, error: "Failed to create conversation" };
  }
}

// ---------------------------------------------------------------------------
// List conversations for the current user
// ---------------------------------------------------------------------------

export async function getConversations(params: {
  tenantId?: string;
  limit?: number;
}): Promise<ActionResult<Conversation[]>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const { tenantId, limit = 50 } = params;

    const conditions = [eq(aiChatConversations.userId, currentUser.id)];
    if (tenantId) {
      conditions.push(eq(aiChatConversations.tenantId, tenantId));
    }

    const conversations = await db.query.aiChatConversations.findMany({
      where: and(...conditions),
      orderBy: desc(aiChatConversations.updatedAt),
      limit,
    });

    // Get the first user message for each conversation to show as preview
    const result: Conversation[] = await Promise.all(
      conversations.map(async (conv) => {
        const firstMsg = await db.query.aiAgentExecutions.findFirst({
          where: and(
            eq(aiAgentExecutions.conversationId, conv.id),
            eq(aiAgentExecutions.agentType, "GENERAL_ASSISTANT")
          ),
          orderBy: asc(aiAgentExecutions.createdAt),
          columns: { input: true },
        });

        const msgCount = await db
          .select({ id: aiAgentExecutions.id })
          .from(aiAgentExecutions)
          .where(
            and(
              eq(aiAgentExecutions.conversationId, conv.id),
              eq(aiAgentExecutions.agentType, "GENERAL_ASSISTANT")
            )
          );

        return {
          id: conv.id,
          title: conv.title,
          tenantId: conv.tenantId,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          messageCount: msgCount.length,
          lastMessage: firstMsg?.input?.slice(0, 100),
        };
      })
    );

    return { success: true, data: result };
  } catch (error) {
    console.error("Error listing conversations:", error);
    return { success: false, error: "Failed to list conversations" };
  }
}

// ---------------------------------------------------------------------------
// Get messages for a specific conversation
// ---------------------------------------------------------------------------

export async function getConversationMessages(params: {
  conversationId: string;
}): Promise<ActionResult<Array<{ id: string; role: string; content: string; timestamp: Date }>>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify ownership
    const conversation = await db.query.aiChatConversations.findFirst({
      where: and(
        eq(aiChatConversations.id, params.conversationId),
        eq(aiChatConversations.userId, currentUser.id)
      ),
    });
    if (!conversation) {
      return { success: false, error: "Conversation not found" };
    }

    const executions = await db.query.aiAgentExecutions.findMany({
      where: and(
        eq(aiAgentExecutions.conversationId, params.conversationId),
        eq(aiAgentExecutions.agentType, "GENERAL_ASSISTANT")
      ),
      orderBy: asc(aiAgentExecutions.createdAt),
    });

    const messages = executions.flatMap((exec) => [
      {
        id: `${exec.id}-user`,
        role: "user" as const,
        content: exec.input || "",
        timestamp: exec.createdAt,
      },
      ...(exec.output
        ? [
            {
              id: `${exec.id}-assistant`,
              role: "assistant" as const,
              content: exec.output,
              timestamp: new Date(exec.createdAt.getTime() + (exec.duration || 1000)),
            },
          ]
        : []),
    ]);

    return { success: true, data: messages };
  } catch (error) {
    console.error("Error fetching conversation messages:", error);
    return { success: false, error: "Failed to fetch messages" };
  }
}

// ---------------------------------------------------------------------------
// Rename a conversation
// ---------------------------------------------------------------------------

export async function renameConversation(params: {
  conversationId: string;
  title: string;
}): Promise<ActionResult<void>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const conversation = await db.query.aiChatConversations.findFirst({
      where: and(
        eq(aiChatConversations.id, params.conversationId),
        eq(aiChatConversations.userId, currentUser.id)
      ),
    });
    if (!conversation) {
      return { success: false, error: "Conversation not found" };
    }

    await db
      .update(aiChatConversations)
      .set({ title: params.title.trim().slice(0, 200) })
      .where(eq(aiChatConversations.id, params.conversationId));

    revalidatePath("/dashboard/ai-agents");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error renaming conversation:", error);
    return { success: false, error: "Failed to rename conversation" };
  }
}

// ---------------------------------------------------------------------------
// Delete a conversation and its messages
// ---------------------------------------------------------------------------

export async function deleteConversation(params: {
  conversationId: string;
}): Promise<ActionResult<void>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const conversation = await db.query.aiChatConversations.findFirst({
      where: and(
        eq(aiChatConversations.id, params.conversationId),
        eq(aiChatConversations.userId, currentUser.id)
      ),
    });
    if (!conversation) {
      return { success: false, error: "Conversation not found" };
    }

    // Delete associated executions first
    await db
      .delete(aiAgentExecutions)
      .where(eq(aiAgentExecutions.conversationId, params.conversationId));

    // Delete the conversation
    await db
      .delete(aiChatConversations)
      .where(eq(aiChatConversations.id, params.conversationId));

    revalidatePath("/dashboard/ai-agents");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return { success: false, error: "Failed to delete conversation" };
  }
}

// ---------------------------------------------------------------------------
// Auto-generate title from the first message using AI
// ---------------------------------------------------------------------------

export async function autoTitleConversation(params: {
  conversationId: string;
  firstMessage: string;
}): Promise<ActionResult<string>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    let title: string;

    try {
      // Use AI to generate a concise, descriptive title
      const result = await runText({
        system: "You are a title generator. Given a user message from a chat conversation about SAP CPI (Cloud Platform Integration), generate a very short, descriptive title (3-6 words max). Return ONLY the title text, nothing else. No quotes, no punctuation at the end, no prefixes.",
        prompt: `Generate a short chat title for this message:\n\n"${params.firstMessage.slice(0, 300)}"`,
        temperature: 0.3,
        maxTokens: 30,
        modelKind: "fast",
      });

      title = result.text
        .trim()
        .replace(/^["']|["']$/g, "") // Remove surrounding quotes
        .replace(/\.$/, "")          // Remove trailing period
        .slice(0, 100);

      // Fallback if AI returns empty or nonsensical result
      if (!title || title.length < 2) {
        title = generateFallbackTitle(params.firstMessage);
      }
    } catch {
      // If AI fails, fall back to heuristic
      title = generateFallbackTitle(params.firstMessage);
    }

    await db
      .update(aiChatConversations)
      .set({ title, updatedAt: new Date() })
      .where(
        and(
          eq(aiChatConversations.id, params.conversationId),
          eq(aiChatConversations.userId, currentUser.id)
        )
      );

    return { success: true, data: title };
  } catch (error) {
    console.error("Error auto-titling conversation:", error);
    return { success: false, error: "Failed to auto-title" };
  }
}

function generateFallbackTitle(message: string): string {
  let title = message.trim().replace(/\s+/g, " ");
  if (title.length > 50) {
    title = title.slice(0, 47).replace(/\s+\S*$/, "") + "…";
  }
  return title;
}

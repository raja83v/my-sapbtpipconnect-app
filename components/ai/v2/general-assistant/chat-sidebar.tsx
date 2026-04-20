"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getConversations,
  deleteConversation,
  renameConversation,
  type Conversation,
} from "@/app/actions/ai-conversations";
import { toast } from "sonner";

interface ChatSidebarProps {
  tenantId?: string;
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function ChatSidebar({
  tenantId,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  collapsed,
  onToggleCollapse,
}: ChatSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConversations();
  }, [tenantId]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const result = await getConversations({ tenantId, limit: 50 });
      if (result.success && result.data) {
        setConversations(result.data);
      }
    } catch {
      console.error("Failed to load conversations");
    } finally {
      setIsLoading(false);
    }
  };

  // Expose refresh for parent
  const refreshConversations = loadConversations;

  // Attach refresh to window for cross-component communication
  useEffect(() => {
    (window as any).__refreshChatSidebar = refreshConversations;
    return () => {
      delete (window as any).__refreshChatSidebar;
    };
  }, [tenantId]);

  const handleDelete = async (id: string) => {
    const result = await deleteConversation({ conversationId: id });
    if (result.success) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        onNewChat();
      }
      toast.success("Conversation deleted");
    } else {
      toast.error("Failed to delete conversation");
    }
  };

  const handleStartRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleSaveRename = async () => {
    if (!editingId || !editTitle.trim()) {
      setEditingId(null);
      return;
    }
    const result = await renameConversation({
      conversationId: editingId,
      title: editTitle.trim(),
    });
    if (result.success) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === editingId ? { ...c, title: editTitle.trim() } : c
        )
      );
    } else {
      toast.error("Failed to rename conversation");
    }
    setEditingId(null);
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditTitle("");
  };

  // Group conversations by date
  const groupedConversations = groupByDate(conversations);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-3 gap-2 border-r bg-muted/30 w-12 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggleCollapse}
          aria-label="Expand sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onNewChat}
          aria-label="New chat"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col border-r bg-muted/30 w-64 shrink-0">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 text-sm font-medium flex-1 justify-start"
          onClick={onNewChat}
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onToggleCollapse}
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-2">
          {isLoading ? (
            <div className="space-y-2 px-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-9 rounded-md bg-muted/50 animate-pulse"
                />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground">
                No conversations yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Start a new chat to begin
              </p>
            </div>
          ) : (
            Object.entries(groupedConversations).map(
              ([group, convs]) =>
                convs.length > 0 && (
                  <div key={group} className="mb-3">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group}
                    </p>
                    <div className="space-y-0.5">
                      {convs.map((conv) => (
                        <ConversationItem
                          key={conv.id}
                          conversation={conv}
                          isActive={conv.id === activeConversationId}
                          isEditing={conv.id === editingId}
                          editTitle={editTitle}
                          editInputRef={editInputRef}
                          onSelect={() => onSelectConversation(conv.id)}
                          onStartRename={() => handleStartRename(conv)}
                          onSaveRename={handleSaveRename}
                          onCancelRename={handleCancelRename}
                          onEditTitleChange={setEditTitle}
                          onDelete={() => handleDelete(conv.id)}
                        />
                      ))}
                    </div>
                  </div>
                )
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual conversation item
// ---------------------------------------------------------------------------

function ConversationItem({
  conversation,
  isActive,
  isEditing,
  editTitle,
  editInputRef,
  onSelect,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onEditTitleChange,
  onDelete,
}: {
  conversation: Conversation;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: () => void;
  onStartRename: () => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onEditTitleChange: (value: string) => void;
  onDelete: () => void;
}) {
  if (isEditing) {
    return (
      <div className="flex items-center gap-1 px-1">
        <input
          ref={editInputRef}
          value={editTitle}
          onChange={(e) => onEditTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveRename();
            if (e.key === "Escape") onCancelRename();
          }}
          className="flex-1 h-8 px-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          maxLength={200}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onSaveRename}
          aria-label="Save"
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onCancelRename}
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-md px-1 cursor-pointer",
        isActive
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted/80 text-foreground"
      )}
    >
      <button
        className="flex-1 flex items-center gap-2 py-2 px-1 text-left min-w-0"
        onClick={onSelect}
      >
        <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span className="text-sm truncate">{conversation.title}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Conversation options"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem onClick={onStartRename}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date grouping utility
// ---------------------------------------------------------------------------

function groupByDate(
  conversations: Conversation[]
): Record<string, Conversation[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const monthAgo = new Date(today.getTime() - 30 * 86400000);

  const groups: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 Days": [],
    "Previous 30 Days": [],
    Older: [],
  };

  for (const conv of conversations) {
    const d = new Date(conv.updatedAt);
    if (d >= today) {
      groups["Today"].push(conv);
    } else if (d >= yesterday) {
      groups["Yesterday"].push(conv);
    } else if (d >= weekAgo) {
      groups["Previous 7 Days"].push(conv);
    } else if (d >= monthAgo) {
      groups["Previous 30 Days"].push(conv);
    } else {
      groups["Older"].push(conv);
    }
  }

  return groups;
}

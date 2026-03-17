"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Check, ChevronDown, ExternalLink, MapPin, MessageSquare, MoreHorizontal, Pencil, Pin, PinOff, Search, SendHorizontal, Smile, Trash2, Users, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfilePreviewCard, type ProfilePreviewContact } from "@/components/dashboard/profile-preview-card";
import type { UserRoleValue } from "@/lib/enums";
import { MESSAGE_EDIT_DELETE_WINDOW_MS } from "@/lib/validators";
import emojiData from "@emoji-mart/data";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EmojiPicker = dynamic<any>(() => import("@emoji-mart/react"), { ssr: false });

type ThreadParticipant = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

type Thread = {
  id: string;
  type: "DIRECT" | "GROUP";
  title: string | null;
  description: string | null;
  participants: ThreadParticipant[];
  lastMessage: {
    body: string;
    createdAt: string;
    isRead: boolean;
  } | null;
};

type Message = {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  pinnedAt: string | null;
  pinnedById: string | null;
  senderId: string;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    profile?: {
      avatarUrl: string | null;
    } | null;
  };
  receipts: { userId: string; readAt: string }[];
};

type MessageListMeta = {
  limit: number;
  hasMoreOlder: boolean;
  oldestMessageAt: string | null;
  newestMessageAt: string | null;
};

type MessagesPanelProps = {
  currentUserId: string;
  currentUserRole: UserRoleValue;
};

type MessageStreamEvent =
  | { type: "connected"; at: string }
  | {
      type: "message_created";
      threadId: string;
      messageId: string;
      senderId: string;
      recipientId: string;
      recipientIds?: string[];
      createdAt: string;
    }
  | { type: "message_updated"; threadId: string; messageId: string; body: string; editedAt: string }
  | { type: "message_deleted"; threadId: string; messageId: string; deletedAt: string }
  | { type: "message_pinned"; threadId: string; messageId: string; pinnedAt: string; pinnedById: string }
  | { type: "message_unpinned"; threadId: string; messageId: string; pinnedAt: null; pinnedById: null };

const STREAM_RETRY_MS = 3000;
const MESSAGE_POLL_MS = 4000;
const MESSAGE_PAGE_SIZE = 80;
const SKILL_DISCOVERY_ROLES: UserRoleValue[] = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];
const GROUP_CHAT_ROLES: UserRoleValue[] = ["SUPER_ADMIN", "ADMIN"];

function initials(firstName: string, lastName: string) {
  return `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase() || "KP";
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function mergeMessagesChronologically(existing: Message[], incoming: Message[]) {
  if (incoming.length === 0) {
    return existing;
  }
  const byId = new Map<string, Message>();
  for (const message of existing) {
    byId.set(message.id, message);
  }
  for (const message of incoming) {
    byId.set(message.id, message);
  }
  return Array.from(byId.values()).sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

export function MessagesPanel({ currentUserId, currentUserRole }: MessagesPanelProps) {
  const searchParams = useSearchParams();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [contacts, setContacts] = useState<ProfilePreviewContact[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
  const [groupTitle, setGroupTitle] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupEditTitle, setGroupEditTitle] = useState("");
  const [groupEditDescription, setGroupEditDescription] = useState("");
  const [savingGroupMeta, setSavingGroupMeta] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [manageAddMemberIds, setManageAddMemberIds] = useState<string[]>([]);
  const [addingMember, setAddingMember] = useState(false);
  const [groupManageOpen, setGroupManageOpen] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [pinningMessageId, setPinningMessageId] = useState<string | null>(null);
  const [groupMemberPickerId, setGroupMemberPickerId] = useState("");
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [previewContact, setPreviewContact] = useState<ProfilePreviewContact | null>(null);
  const selectedThreadIdRef = useRef<string>("");
  const selectedRecipientIdRef = useRef<string>("");
  const groupMemberIdsRef = useRef<string[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const messageElRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastThreadRefreshAtRef = useRef<number>(0);
  const appliedThreadParamRef = useRef<string | null>(null);
  const requestedThreadId = searchParams.get("threadId")?.trim() ?? "";

  const canDiscoverBySkill = SKILL_DISCOVERY_ROLES.includes(currentUserRole);
  const canCreateGroup = GROUP_CHAT_ROLES.includes(currentUserRole);

  const contactsById = useMemo(() => {
    return new Map(contacts.map((contact) => [contact.id, contact]));
  }, [contacts]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId),
    [threads, selectedThreadId],
  );

  const pinnedMessage = useMemo(
    () => messages.find((m) => m.pinnedAt !== null && m.pinnedAt !== undefined && !m.deletedAt) ?? null,
    [messages],
  );

  const selectedContact = useMemo(() => {
    if (activeThread?.type === "GROUP") {
      return null;
    }

    const threadPartner = activeThread?.participants.find((participant) => participant.id !== currentUserId);
    if (threadPartner) {
      return contactsById.get(threadPartner.id) ?? null;
    }

    if (selectedRecipientId) {
      return contactsById.get(selectedRecipientId) ?? null;
    }

    return null;
  }, [activeThread, contactsById, selectedRecipientId, currentUserId]);

  const selectedGroupMembers = useMemo(
    () =>
      groupMemberIds
        .map((memberId) => contactsById.get(memberId))
        .filter((member): member is ProfilePreviewContact => Boolean(member)),
    [groupMemberIds, contactsById],
  );

  const activeGroupMemberIds = useMemo(() => {
    if (activeThread?.type !== "GROUP") {
      return [];
    }
    return activeThread.participants.map((participant) => participant.id);
  }, [activeThread]);

  const filteredContacts = useMemo(() => {
    if (!skillQuery.trim()) {
      return contacts;
    }
    const query = skillQuery.trim().toLowerCase();
    return contacts.filter((contact) =>
      contact.profile.skills.some((skill) => skill.toLowerCase().includes(query)),
    );
  }, [contacts, skillQuery]);

  const manageAddableContacts = useMemo(() => {
    if (activeThread?.type !== "GROUP") {
      return [];
    }
    const memberIds = new Set(activeThread.participants.map((participant) => participant.id));
    return contacts.filter((contact) => !memberIds.has(contact.id));
  }, [contacts, activeThread]);

  useEffect(() => {
    if (manageAddMemberIds.length === 0) {
      return;
    }
    const addableIds = new Set(manageAddableContacts.map((contact) => contact.id));
    setManageAddMemberIds((previous) => {
      const next = previous.filter((id) => addableIds.has(id));
      return next.length === previous.length ? previous : next;
    });
  }, [manageAddableContacts, manageAddMemberIds.length]);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  useEffect(() => {
    selectedRecipientIdRef.current = selectedRecipientId;
  }, [selectedRecipientId]);

  useEffect(() => {
    groupMemberIdsRef.current = groupMemberIds;
  }, [groupMemberIds]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!requestedThreadId) {
      appliedThreadParamRef.current = null;
      return;
    }
    if (appliedThreadParamRef.current === requestedThreadId) {
      return;
    }
    const hasRequestedThread = threads.some((thread) => thread.id === requestedThreadId);
    if (!hasRequestedThread) {
      return;
    }
    setSelectedThreadId(requestedThreadId);
    setSelectedRecipientId("");
    setGroupMemberIds([]);
    appliedThreadParamRef.current = requestedThreadId;
  }, [requestedThreadId, threads]);

  useEffect(() => {
    if (activeThread?.type === "GROUP") {
      setGroupEditTitle(activeThread.title ?? "");
      setGroupEditDescription(activeThread.description ?? "");
      setManageAddMemberIds([]);
      return;
    }
    setGroupManageOpen(false);
    setGroupEditTitle("");
    setGroupEditDescription("");
    setManageAddMemberIds([]);
  }, [activeThread]);

  const loadThreads = useCallback(async () => {
    try {
      const threadResponse = await fetch("/api/messages", { cache: "no-store" });
      if (!threadResponse.ok) {
        return false;
      }
      const payload = await threadResponse.json();
      const nextThreads = (payload.threads ?? []) as Thread[];
      setThreads(nextThreads);
      setSelectedThreadId((previous) => previous || nextThreads[0]?.id || "");
      return true;
    } catch {
      return false;
    }
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      const contactResponse = await fetch("/api/messages/contacts", { cache: "no-store" });
      if (!contactResponse.ok) {
        return false;
      }
      const payload = await contactResponse.json();
      setContacts((payload.contacts ?? []) as ProfilePreviewContact[]);
      return true;
    } catch {
      return false;
    }
  }, []);

  const loadBaseData = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setLoading(true);
      }
      try {
        const [threadsOk, contactsOk] = await Promise.all([loadThreads(), loadContacts()]);
        if (showLoading && !threadsOk && !contactsOk) {
          toast.error("Could not load conversations.");
        }
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [loadContacts, loadThreads],
  );

  const loadMessages = useCallback(
    async (threadId: string, options?: { after?: string; before?: string }) => {
      try {
        const params = new URLSearchParams({
          threadId,
          limit: String(MESSAGE_PAGE_SIZE),
        });
        if (options?.after) {
          params.set("after", options.after);
        }
        if (options?.before) {
          params.set("before", options.before);
        }

        const response = await fetch(`/api/messages?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) {
          return null;
        }
        const payload = await response.json();
        const nextMessages = (payload.messages ?? []) as Message[];
        const meta = (payload.meta ?? null) as MessageListMeta | null;

        setMessages((previous) => {
          if (options?.after || options?.before) {
            return mergeMessagesChronologically(previous, nextMessages);
          }
          return nextMessages;
        });

        if (options?.after) {
          return meta;
        }
        setHasOlderMessages(Boolean(meta?.hasMoreOlder));
        return meta;
      } catch {
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let unmounted = false;

    const connect = () => {
      eventSource = new EventSource("/api/messages/stream");

      eventSource.onopen = () => {
        setRealtimeConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as MessageStreamEvent;
          if (payload.type === "connected") {
            setRealtimeConnected(true);
            return;
          }
          if (payload.type === "message_updated") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === payload.messageId
                  ? { ...m, body: payload.body, editedAt: payload.editedAt }
                  : m,
              ),
            );
            messagesRef.current = messagesRef.current.map((m) =>
              m.id === payload.messageId ? { ...m, body: payload.body, editedAt: payload.editedAt } : m,
            );
            return;
          }
          if (payload.type === "message_deleted") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === payload.messageId
                  ? { ...m, deletedAt: payload.deletedAt, pinnedAt: null, pinnedById: null }
                  : m,
              ),
            );
            messagesRef.current = messagesRef.current.map((m) =>
              m.id === payload.messageId
                ? { ...m, deletedAt: payload.deletedAt, pinnedAt: null, pinnedById: null }
                : m,
            );
            return;
          }
          if (payload.type === "message_pinned" || payload.type === "message_unpinned") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === payload.messageId
                  ? { ...m, pinnedAt: payload.pinnedAt, pinnedById: payload.pinnedById }
                  : m,
              ),
            );
            messagesRef.current = messagesRef.current.map((m) =>
              m.id === payload.messageId ? { ...m, pinnedAt: payload.pinnedAt, pinnedById: payload.pinnedById } : m,
            );
            return;
          }
          if (payload.type !== "message_created") {
            return;
          }

          const activeThreadId = selectedThreadIdRef.current;
          const now = Date.now();
          if (now - lastThreadRefreshAtRef.current >= 1200) {
            lastThreadRefreshAtRef.current = now;
            void loadThreads();
          }
          if (!activeThreadId) {
            const isComposingNewMessage =
              Boolean(selectedRecipientIdRef.current) || groupMemberIdsRef.current.length > 0;
            if (!isComposingNewMessage) {
              setSelectedThreadId(payload.threadId);
              void loadMessages(payload.threadId);
            }
            return;
          }
          if (payload.threadId === activeThreadId) {
            const latestKnownMessageAt = messagesRef.current[messagesRef.current.length - 1]?.createdAt;
            void loadMessages(activeThreadId, latestKnownMessageAt ? { after: latestKnownMessageAt } : undefined);
          }
        } catch {
          // Ignore malformed payloads from stream.
        }
      };

      eventSource.onerror = () => {
        setRealtimeConnected(false);
        eventSource?.close();
        eventSource = null;
        if (!unmounted) {
          reconnectTimeout = setTimeout(connect, STREAM_RETRY_MS);
        }
      };
    };

    connect();

    return () => {
      unmounted = true;
      setRealtimeConnected(false);
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      eventSource?.close();
    };
  }, [loadMessages, loadThreads]);

  useEffect(() => {
    if (!selectedThreadId) {
      return;
    }
    setHasOlderMessages(false);
    void loadMessages(selectedThreadId);

    if (realtimeConnected) {
      return;
    }

    const interval = window.setInterval(() => {
      const latestKnownMessageAt = messagesRef.current[messagesRef.current.length - 1]?.createdAt;
      void loadMessages(selectedThreadId, latestKnownMessageAt ? { after: latestKnownMessageAt } : undefined);
    }, MESSAGE_POLL_MS);

    return () => clearInterval(interval);
  }, [selectedThreadId, realtimeConnected, loadMessages]);

  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([]);
      setHasOlderMessages(false);
    }
  }, [selectedThreadId]);

  const addGroupMember = (userId: string) => {
    setGroupMemberIds((previous) => (previous.includes(userId) ? previous : [...previous, userId]));
    setSelectedRecipientId("");
    if (activeThread?.type !== "GROUP") {
      setSelectedThreadId("");
    }
  };

  const removeDraftGroupMember = (userId: string) => {
    setGroupMemberIds((previous) => previous.filter((memberId) => memberId !== userId));
  };

  const threadDisplayLabel = (thread: Thread) => {
    if (thread.type === "GROUP") {
      if (thread.title?.trim()) {
        return thread.title;
      }
      const others = thread.participants.filter((participant) => participant.id !== currentUserId);
      if (others.length === 0) {
        return "Group Chat";
      }
      const firstTwo = others.slice(0, 2).map((participant) => `${participant.firstName} ${participant.lastName}`);
      if (others.length <= 2) {
        return firstTwo.join(", ");
      }
      return `${firstTwo.join(", ")} +${others.length - 2}`;
    }

    const partner = thread.participants.find((participant) => participant.id !== currentUserId);
    return partner ? `${partner.firstName} ${partner.lastName}` : "Conversation";
  };

  const saveGroupMetadata = async () => {
    if (!selectedThreadId || activeThread?.type !== "GROUP") {
      return;
    }

    setSavingGroupMeta(true);
    try {
      const response = await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: selectedThreadId,
          title: groupEditTitle,
          description: groupEditDescription,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error ?? "Could not update group.");
        return;
      }
      toast.success("Group updated.");
      await loadThreads();
    } catch {
      toast.error("Could not update group.");
    } finally {
      setSavingGroupMeta(false);
    }
  };

  const removeGroupMember = async (userId: string) => {
    if (!selectedThreadId || activeThread?.type !== "GROUP") {
      return;
    }

    setRemovingMemberId(userId);
    try {
      const response = await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: selectedThreadId,
          removeUserId: userId,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error ?? "Could not remove member.");
        return;
      }
      toast.success("Member removed.");
      await loadThreads();
    } catch {
      toast.error("Could not remove member.");
    } finally {
      setRemovingMemberId(null);
    }
  };

  const addGroupMemberFromManage = async () => {
    if (!selectedThreadId || activeThread?.type !== "GROUP" || manageAddMemberIds.length === 0) {
      return;
    }

    setAddingMember(true);
    try {
      const response = await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: selectedThreadId,
          addUserIds: manageAddMemberIds,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error ?? "Could not add member.");
        return;
      }
      toast.success(
        manageAddMemberIds.length === 1 ? "Member added." : `${manageAddMemberIds.length} members added.`,
      );
      setManageAddMemberIds([]);
      await loadThreads();
    } catch {
      toast.error("Could not add member.");
    } finally {
      setAddingMember(false);
    }
  };

  const toggleManageAddMember = (userId: string) => {
    setManageAddMemberIds((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId],
    );
  };

  const createGroupThread = async () => {
    if (!canCreateGroup) {
      return;
    }
    if (groupMemberIds.length < 2) {
      toast.error("Select at least 2 members to create a group.");
      return;
    }

    setCreatingGroup(true);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_GROUP",
          recipientIds: groupMemberIds,
          title: groupTitle.trim() || undefined,
          description: groupDescription.trim() || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error ?? "Could not create group.");
        return;
      }

      const createdThreadId = payload?.threadId as string | undefined;
      setGroupMemberIds([]);
      setGroupTitle("");
      setGroupDescription("");
      setSelectedRecipientId("");
      if (createdThreadId) {
        setSelectedThreadId(createdThreadId);
      }
      await loadThreads();
      if (createdThreadId) {
        await loadMessages(createdThreadId);
      }
      toast.success("Group created.");
    } catch {
      toast.error("Could not create group.");
    } finally {
      setCreatingGroup(false);
    }
  };

  const startEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditDraft(message.body);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditDraft("");
  };

  const saveEdit = async () => {
    if (!editingMessageId || !editDraft.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/messages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: editingMessageId, body: editDraft.trim() }),
      });
      if (!res.ok) {
        const p = await res.json();
        toast.error(p?.error ?? "Could not edit message.");
        return;
      }
      // Optimistic local update (SSE will also propagate)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editingMessageId ? { ...m, body: editDraft.trim(), editedAt: new Date().toISOString() } : m,
        ),
      );
      cancelEdit();
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    setDeletingMessageId(messageId);
    try {
      const res = await fetch("/api/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      if (!res.ok) {
        const p = await res.json();
        toast.error(p?.error ?? "Could not delete message.");
        return;
      }
      // Optimistic local update
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, deletedAt: new Date().toISOString() } : m)),
      );
    } finally {
      setDeletingMessageId(null);
    }
  };

  const pinMessage = async (messageId: string, currentlyPinned: boolean) => {
    setPinningMessageId(messageId);
    try {
      const res = await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: currentlyPinned ? "UNPIN" : "PIN", messageId }),
      });
      if (!res.ok) {
        const p = await res.json();
        toast.error(p?.error ?? "Could not update pin.");
        return;
      }
      // Optimistic local update
      const now = new Date().toISOString();
      setMessages((prev) =>
        prev.map((m) => {
          if (currentlyPinned) {
            return m.id === messageId ? { ...m, pinnedAt: null, pinnedById: null } : m;
          }
          // Unpin all others, pin this one
          if (m.id === messageId) return { ...m, pinnedAt: now, pinnedById: currentUserId };
          return { ...m, pinnedAt: null, pinnedById: null };
        }),
      );
    } finally {
      setPinningMessageId(null);
    }
  };

  const scrollToMessage = (messageId: string) => {
    const el = messageElRefs.current.get(messageId);
    if (el && scrollContainerRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-[#0D1F45]/30", "rounded-xl");
      setTimeout(() => el.classList.remove("ring-2", "ring-[#0D1F45]/30", "rounded-xl"), 1800);
    }
  };

  const sendMessage = async () => {
    if (!draft.trim()) {
      return;
    }

    let requestBody:
      | { threadId: string; body: string }
      | { threadId: string; recipientIds: string[]; body: string }
      | { recipientIds: string[]; title?: string; description?: string; body: string }
      | { recipientId: string; body: string };
    let mode: "thread" | "group" | "group_add" | "direct";

    if (selectedThreadId) {
      if (canCreateGroup && activeThread?.type === "GROUP" && groupMemberIds.length > 0) {
        requestBody = {
          threadId: selectedThreadId,
          recipientIds: groupMemberIds,
          body: draft,
        };
        mode = "group_add";
      } else {
        requestBody = {
          threadId: selectedThreadId,
          body: draft,
        };
        mode = "thread";
      }
    } else if (canCreateGroup && groupMemberIds.length > 1) {
      requestBody = {
        recipientIds: groupMemberIds,
        title: groupTitle.trim() || undefined,
        description: groupDescription.trim() || undefined,
        body: draft,
      };
      mode = "group";
    } else if (selectedRecipientId) {
      requestBody = {
        recipientId: selectedRecipientId,
        body: draft,
      };
      mode = "direct";
    } else {
      toast.error("Choose a thread, contact, or at least two group members.");
      return;
    }

    setSending(true);
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const payload = await response.json();
    setSending(false);

    if (!response.ok) {
      toast.error(payload?.error ?? "Could not send message.");
      return;
    }

    const previouslySelectedThreadId = selectedThreadIdRef.current;
    const latestKnownMessageAt = messagesRef.current[messagesRef.current.length - 1]?.createdAt;

    setDraft("");
    setSelectedThreadId(payload.threadId);
    if (mode === "direct") {
      setSelectedRecipientId("");
    }
    if (mode === "group" || mode === "group_add") {
      setGroupMemberIds([]);
      setGroupTitle("");
      setGroupDescription("");
    }
    await loadThreads();
    await loadMessages(
      payload.threadId,
      payload.threadId === previouslySelectedThreadId && latestKnownMessageAt
        ? { after: latestKnownMessageAt }
        : undefined,
    );
  };

  const loadOlderMessages = async () => {
    if (!selectedThreadId || loadingOlderMessages || messages.length === 0) {
      return;
    }
    const oldestMessageAt = messages[0]?.createdAt;
    if (!oldestMessageAt) {
      return;
    }

    setLoadingOlderMessages(true);
    try {
      await loadMessages(selectedThreadId, { before: oldestMessageAt });
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    setDraft((previous) => `${previous}${emoji}`);
    setEmojiPickerOpen(false);
  };

  return (
    <section className="grid grid-cols-1 gap-4 max-[360px]:gap-3 xl:grid-cols-[320px_1fr]">
      <aside className="kat-card flex h-[72dvh] min-h-[420px] max-h-[880px] min-w-0 flex-col overflow-hidden max-[360px]:h-[68dvh] max-[360px]:min-h-[360px] sm:h-[74dvh] md:h-[78dvh]">
        {/* ── Fixed header ── */}
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold max-[360px]:text-base">Conversations</h3>
          {threads.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {threads.length}
            </span>
          )}
        </div>

        {/* ── Scrollable thread list ── */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="space-y-1.5">
              <Skeleton className="h-[60px] w-full rounded-xl" />
              <Skeleton className="h-[60px] w-full rounded-xl" />
              <Skeleton className="h-[60px] w-full rounded-xl" />
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-slate-100">
                <MessageSquare className="size-5 text-slate-400" />
              </div>
              <p className="text-xs text-slate-500">No conversations yet</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {threads.map((thread) => {
                const partner = thread.participants.find((participant) => participant.id !== currentUserId);
                const contact = partner ? contactsById.get(partner.id) : null;
                const isGroup = thread.type === "GROUP";
                const threadLabel = threadDisplayLabel(thread);
                return (
                  <button
                    key={thread.id}
                    onClick={() => {
                      setSelectedThreadId(thread.id);
                      setSelectedRecipientId("");
                      setGroupMemberIds([]);
                    }}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition max-[360px]:px-2.5 max-[360px]:py-2 ${
                      selectedThreadId === thread.id
                        ? "border-[#0D1F45] bg-[#0D1F45] text-white"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="relative shrink-0">
                        <Avatar className={`size-9 border ${selectedThreadId === thread.id ? "border-white/20" : "border-slate-200"}`}>
                          <AvatarImage
                            src={!isGroup ? contact?.avatarUrl ?? undefined : undefined}
                            alt={threadLabel}
                          />
                          <AvatarFallback className={`text-[10px] font-semibold ${selectedThreadId === thread.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}`}>
                            {isGroup ? <Users className="size-4" /> : partner ? initials(partner.firstName, partner.lastName) : "CV"}
                          </AvatarFallback>
                        </Avatar>
                        {!thread.lastMessage?.isRead && thread.lastMessage && selectedThreadId !== thread.id && (
                          <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-white bg-blue-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className={`truncate text-sm font-semibold ${selectedThreadId === thread.id ? "text-white" : "text-slate-900"}`}>{threadLabel}</p>
                          {thread.lastMessage?.createdAt && (
                            <span className={`shrink-0 text-[10px] ${selectedThreadId === thread.id ? "text-blue-200" : "text-slate-400"}`}>
                              {relativeTime(thread.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        <p className={`mt-0.5 truncate text-xs ${selectedThreadId === thread.id ? "text-blue-100" : "text-slate-500"}`}>
                          {thread.lastMessage?.body ?? (isGroup ? `${thread.participants.length - 1} participants` : "No messages yet")}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Composer — pinned to bottom ── */}
        <div className="mt-3 shrink-0 space-y-2 border-t border-slate-100 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">New Message</p>

          {/* Skill search (admins / instructors) */}
          {canDiscoverBySkill ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-9 pl-8 text-sm"
                placeholder="Search contacts by skill…"
                value={skillQuery}
                onChange={(event) => setSkillQuery(event.target.value)}
              />
            </div>
          ) : null}

          {/* Skill results */}
          {canDiscoverBySkill && skillQuery.trim() ? (
            <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
              {filteredContacts.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-slate-500">No contacts match this skill.</p>
              ) : (
                filteredContacts.slice(0, 5).map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      setSelectedRecipientId(contact.id);
                      setSelectedThreadId("");
                      setGroupMemberIds([]);
                      setSkillQuery("");
                    }}
                  >
                    <ProfilePreviewCard contact={contact} compact />
                  </button>
                ))
              )}
            </div>
          ) : null}

          {/* Direct message contact picker */}
          <Select
            value={selectedRecipientId || undefined}
            onValueChange={(value) => {
              setSelectedRecipientId(value);
              setSelectedThreadId("");
              setGroupMemberIds([]);
            }}
          >
            <SelectTrigger className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-200">
              <SelectValue placeholder="Send a direct message…" />
            </SelectTrigger>
            <SelectContent className="max-h-56 overflow-y-auto" position="popper" side="top" align="start" sideOffset={6}>
              {filteredContacts.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.firstName} {contact.lastName} ({contact.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Group chat toggle (admin only) */}
          {canCreateGroup ? (
            <>
              <button
                type="button"
                onClick={() => setNewGroupOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <Users className="size-4 text-slate-400" />
                  New Group Chat
                  {groupMemberIds.length > 0 && (
                    <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                      {groupMemberIds.length}
                    </span>
                  )}
                </span>
                <ChevronDown className={`size-4 text-slate-400 transition-transform duration-200 ${newGroupOpen ? "rotate-180" : ""}`} />
              </button>

              {newGroupOpen ? (
                <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="space-y-2">
                    <Input
                      className="h-9 text-sm"
                      placeholder="Group name (optional)"
                      value={groupTitle}
                      onChange={(event) => setGroupTitle(event.target.value)}
                    />
                    <Input
                      className="h-9 text-sm"
                      placeholder="Description (optional)"
                      value={groupDescription}
                      onChange={(event) => setGroupDescription(event.target.value)}
                    />
                    <Select
                      value={groupMemberPickerId || undefined}
                      onValueChange={(value) => {
                        setGroupMemberPickerId(value);
                        addGroupMember(value);
                        setGroupMemberPickerId("");
                      }}
                    >
                      <SelectTrigger className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-200">
                        <SelectValue placeholder="Add member…" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56 overflow-y-auto" position="popper" side="top" align="start" sideOffset={6}>
                        {filteredContacts
                          .filter(
                            (contact) =>
                              !groupMemberIds.includes(contact.id) &&
                              (!activeThread || activeThread.type !== "GROUP" || !activeGroupMemberIds.includes(contact.id)),
                          )
                          .map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                              {contact.firstName} {contact.lastName} ({contact.role})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>

                    {selectedGroupMembers.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedGroupMembers.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            onClick={() => removeDraftGroupMember(member.id)}
                          >
                            {member.firstName} {member.lastName}
                            <X className="size-3 shrink-0" />
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between pt-0.5">
                      <p className="text-[11px] text-slate-500">
                        {groupMemberIds.length < 2 ? "Add at least 2 members" : `${groupMemberIds.length} members selected`}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 bg-[#0D1F45] px-3 text-xs hover:bg-[#162d5e]"
                        disabled={creatingGroup || groupMemberIds.length < 2}
                        onClick={() => void createGroupThread()}
                      >
                        {creatingGroup ? "Creating…" : "Create Group"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </aside>

      <div className="kat-card flex h-[72dvh] min-h-[420px] max-h-[880px] min-w-0 flex-col overflow-hidden max-[360px]:h-[68dvh] max-[360px]:min-h-[360px] sm:h-[74dvh] md:h-[78dvh]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {activeThread ? (
              <>
                {activeThread.type === "GROUP" ? (
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
                    <Users className="size-4 text-slate-600" />
                  </div>
                ) : selectedContact ? (
                  <button
                    type="button"
                    className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    onClick={() => setPreviewContact(selectedContact)}
                  >
                    <Avatar className="size-9 border border-slate-200">
                      <AvatarImage src={selectedContact.avatarUrl ?? undefined} alt={`${selectedContact.firstName} ${selectedContact.lastName}`} />
                      <AvatarFallback className="bg-slate-100 text-[10px] font-semibold text-slate-700">
                        {initials(selectedContact.firstName, selectedContact.lastName)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                ) : null}
                <div className="min-w-0">
                  {activeThread.type !== "GROUP" && selectedContact ? (
                    <button
                      type="button"
                      className="truncate font-semibold text-slate-900 hover:underline [font-family:var(--font-space-grotesk)] focus-visible:outline-none"
                      onClick={() => setPreviewContact(selectedContact)}
                    >
                      {threadDisplayLabel(activeThread)}
                    </button>
                  ) : (
                    <p className="truncate font-semibold text-slate-900 [font-family:var(--font-space-grotesk)]">
                      {threadDisplayLabel(activeThread)}
                    </p>
                  )}
                  {activeThread.type !== "GROUP" && selectedContact?.profile.headline ? (
                    <p className="truncate text-xs text-slate-500">{selectedContact.profile.headline}</p>
                  ) : activeThread.type === "GROUP" ? (
                    <p className="text-xs text-slate-500">{activeThread.participants.length - 1} participants</p>
                  ) : null}
                </div>
              </>
            ) : selectedContact ? (
              <>
                <button
                  type="button"
                  className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  onClick={() => setPreviewContact(selectedContact)}
                >
                  <Avatar className="size-9 border border-slate-200">
                    <AvatarImage src={selectedContact.avatarUrl ?? undefined} alt={`${selectedContact.firstName} ${selectedContact.lastName}`} />
                    <AvatarFallback className="bg-slate-100 text-[10px] font-semibold text-slate-700">
                      {initials(selectedContact.firstName, selectedContact.lastName)}
                    </AvatarFallback>
                  </Avatar>
                </button>
                <div className="min-w-0">
                  <button
                    type="button"
                    className="truncate font-semibold text-slate-900 hover:underline [font-family:var(--font-space-grotesk)] focus-visible:outline-none"
                    onClick={() => setPreviewContact(selectedContact)}
                  >
                    {selectedContact.firstName} {selectedContact.lastName}
                  </button>
                  {selectedContact.profile.headline ? (
                    <p className="truncate text-xs text-slate-500">{selectedContact.profile.headline}</p>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">Select a conversation to get started</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              title={realtimeConnected ? "Live" : "Reconnecting…"}
              className={`size-2 rounded-full ${realtimeConnected ? "bg-emerald-500" : "bg-amber-400"}`}
            />
            {canCreateGroup && activeThread?.type === "GROUP" ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="shrink-0"
                aria-label="Manage group settings"
                onClick={() => setGroupManageOpen(true)}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>

        {canCreateGroup && activeThread?.type === "GROUP" ? (
          <Dialog open={groupManageOpen} onOpenChange={setGroupManageOpen}>
            <DialogContent className="w-[min(96vw,42rem)] max-w-2xl">
              <DialogHeader>
                <DialogTitle>Manage Group</DialogTitle>
                <DialogDescription>Update group details, add members, and remove members.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-900">{threadDisplayLabel(activeThread)}</p>
                  <p className="text-xs text-slate-600">{activeThread.participants.length - 1} participant(s)</p>
                  {activeThread.description ? (
                    <p className="mt-1 text-xs text-slate-600">{activeThread.description}</p>
                  ) : null}
                </div>
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Group Details</p>
                  <Input
                    value={groupEditTitle}
                    onChange={(event) => setGroupEditTitle(event.target.value)}
                    placeholder="Group name"
                  />
                  <Input
                    value={groupEditDescription}
                    onChange={(event) => setGroupEditDescription(event.target.value)}
                    placeholder="Group description"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={savingGroupMeta}
                    onClick={() => void saveGroupMetadata()}
                  >
                    {savingGroupMeta ? "Saving..." : "Save Group Details"}
                  </Button>
                </div>

                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Members</p>
                  {manageAddableContacts.length > 0 ? (
                    <div className="space-y-2">
                      <div className="max-h-32 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
                        <div className="space-y-1.5">
                          {manageAddableContacts.map((contact) => (
                            <label key={contact.id} className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                className="size-3.5 rounded border-slate-300 text-blue-600"
                                checked={manageAddMemberIds.includes(contact.id)}
                                onChange={() => toggleManageAddMember(contact.id)}
                              />
                              <span className="truncate">
                                {contact.firstName} {contact.lastName} ({contact.role})
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-slate-500">{manageAddMemberIds.length} selected</p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={manageAddableContacts.length === 0}
                            onClick={() =>
                              setManageAddMemberIds((previous) =>
                                previous.length === manageAddableContacts.length
                                  ? []
                                  : manageAddableContacts.map((contact) => contact.id),
                              )
                            }
                          >
                            {manageAddMemberIds.length === manageAddableContacts.length ? "Clear All" : "Select All"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={addingMember || manageAddMemberIds.length === 0}
                            onClick={() => void addGroupMemberFromManage()}
                          >
                            {addingMember ? "Adding..." : "Add Selected"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No more members to add.</p>
                  )}
                  <div className="max-h-48 overflow-y-auto pr-1">
                    <div className="flex flex-wrap gap-1.5">
                      {activeThread.participants
                        .filter((participant) => participant.id !== currentUserId)
                        .map((participant) => (
                          <span
                            key={participant.id}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700"
                          >
                            {participant.firstName} {participant.lastName}
                            <button
                              type="button"
                              className="text-rose-600 hover:text-rose-700"
                              disabled={removingMemberId === participant.id}
                              onClick={() => void removeGroupMember(participant.id)}
                            >
                              {removingMemberId === participant.id ? "..." : <X className="size-3" />}
                            </button>
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}

        {/* ── Pinned message banner ── */}
        {pinnedMessage && activeThread?.type === "GROUP" ? (
          <button
            type="button"
            onClick={() => scrollToMessage(pinnedMessage.id)}
            className="mt-2 flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left transition hover:bg-amber-100"
          >
            <Pin className="size-3.5 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-amber-800">
                {pinnedMessage.sender.firstName} {pinnedMessage.sender.lastName}
              </p>
              <p className="truncate text-xs text-amber-700">{pinnedMessage.body}</p>
            </div>
            {currentUserRole === "SUPER_ADMIN" ? (
              <button
                type="button"
                title="Unpin"
                onClick={(e) => { e.stopPropagation(); void pinMessage(pinnedMessage.id, true); }}
                className="shrink-0 rounded p-0.5 text-amber-500 hover:bg-amber-200 hover:text-amber-700"
              >
                <X className="size-3" />
              </button>
            ) : null}
          </button>
        ) : null}

        <div ref={scrollContainerRef} className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
          {selectedThreadId && hasOlderMessages ? (
            <div className="flex justify-center pb-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loadingOlderMessages}
                onClick={() => void loadOlderMessages()}
              >
                {loadingOlderMessages ? "Loading..." : "Load older messages"}
              </Button>
            </div>
          ) : null}
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-slate-100">
                <MessageSquare className="size-6 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">No messages yet</p>
                <p className="mt-0.5 text-xs text-slate-500">Say hello and start the conversation.</p>
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const mine = message.senderId === currentUserId;
              const isAdmin = currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN";
              const isSuperAdmin = currentUserRole === "SUPER_ADMIN";
              const withinEditWindow = Date.now() - new Date(message.createdAt).getTime() <= MESSAGE_EDIT_DELETE_WINDOW_MS;
              const canEdit = mine && !message.deletedAt && withinEditWindow;
              const canDelete = (mine || isAdmin) && !message.deletedAt && (isAdmin || withinEditWindow);
              const canPin = isSuperAdmin && activeThread?.type === "GROUP" && !message.deletedAt;
              const isPinned = Boolean(message.pinnedAt);
              const isEditing = editingMessageId === message.id;
              const isDeleting = deletingMessageId === message.id;
              const isPinning = pinningMessageId === message.id;
              const showGroupSenderMeta = activeThread?.type === "GROUP";
              const senderDisplayName = mine ? "You" : `${message.sender.firstName} ${message.sender.lastName}`;
              const senderAvatarUrl =
                message.sender.profile?.avatarUrl ?? contactsById.get(message.senderId)?.avatarUrl ?? undefined;
              return (
                <motion.div
                  key={message.id}
                  ref={(el) => {
                    if (el) messageElRefs.current.set(message.id, el);
                    else messageElRefs.current.delete(message.id);
                  }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`group flex max-w-[88%] items-end gap-1 max-[360px]:max-w-[92%] sm:max-w-[75%] ${mine ? "ml-auto flex-row-reverse" : "flex-row"}`}
                >
                  {/* Action buttons — beside bubble so they're never clipped by scroll container */}
                  {(canEdit || canDelete || canPin) && !isEditing && (
                    <div className="mb-1.5 flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {canPin && (
                        <button
                          type="button"
                          disabled={isPinning}
                          onClick={() => void pinMessage(message.id, isPinned)}
                          className={`rounded-md bg-white p-1 shadow-sm ring-1 ring-slate-200 transition-colors ${isPinned ? "text-amber-500 hover:text-amber-600" : "text-slate-400 hover:text-amber-500"}`}
                          title={isPinned ? "Unpin" : "Pin message"}
                        >
                          {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                        </button>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => startEdit(message)}
                          className="rounded-md bg-white p-1 text-slate-400 shadow-sm ring-1 ring-slate-200 hover:text-blue-600 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void deleteMessage(message.id)}
                          disabled={isDeleting}
                          className="rounded-md bg-white p-1 text-slate-400 shadow-sm ring-1 ring-slate-200 hover:text-rose-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className={`min-w-0 rounded-xl px-3 py-2 text-sm max-[360px]:px-2.5 max-[360px]:py-1.5 max-[360px]:text-xs ${
                    message.deletedAt
                      ? "border border-slate-200 bg-slate-100 italic text-slate-400"
                      : mine
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 bg-white text-slate-900"
                  }`}>
                    {showGroupSenderMeta && !message.deletedAt ? (
                      <div className={`mb-1 flex items-center gap-1.5 ${mine ? "justify-end" : ""}`}>
                        <button
                          type="button"
                          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                          onClick={() => {
                            const c = contactsById.get(message.senderId);
                            if (c) setPreviewContact(c);
                          }}
                        >
                          <Avatar className={`size-5 border ${mine ? "border-blue-300" : "border-slate-200"}`}>
                            <AvatarImage src={senderAvatarUrl} alt={senderDisplayName} />
                            <AvatarFallback
                              className={`text-[9px] font-semibold ${mine ? "bg-blue-500 text-blue-100" : "bg-slate-100 text-slate-700"}`}
                            >
                              {initials(message.sender.firstName, message.sender.lastName)}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                        <button
                          type="button"
                          className={`text-[11px] font-medium hover:underline focus-visible:outline-none ${mine ? "text-blue-100" : "text-slate-600"}`}
                          onClick={() => {
                            const c = contactsById.get(message.senderId);
                            if (c) setPreviewContact(c);
                          }}
                        >
                          {senderDisplayName}
                        </button>
                      </div>
                    ) : null}

                    {message.deletedAt ? (
                      <p>Message deleted</p>
                    ) : isEditing ? (
                      <div className="space-y-1.5">
                        <textarea
                          className="w-full rounded-lg border border-blue-300 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-blue-400"
                          rows={2}
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void saveEdit(); }
                            if (e.key === "Escape") cancelEdit();
                          }}
                          autoFocus
                        />
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void saveEdit()}
                            disabled={savingEdit || !editDraft.trim()}
                            className="flex items-center gap-1 rounded-md bg-blue-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Check className="h-3 w-3" /> Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="flex items-center gap-1 rounded-md bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-300"
                          >
                            <X className="h-3 w-3" /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={mine ? "text-white" : "text-slate-900"}>{message.body}</p>
                    )}

                    {!message.deletedAt && !isEditing && (
                      <p className={`mt-1 flex items-center gap-1.5 text-[10px] ${mine ? "justify-end text-blue-100" : "text-slate-400"}`}>
                        <span>{relativeTime(message.createdAt)}</span>
                        {message.editedAt && <span className="opacity-70">· edited</span>}
                        {mine && <span className="opacity-80">{message.receipts.length > 1 ? "· Read" : "· Sent"}</span>}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        <div className="mt-3 shrink-0 rounded-xl border border-slate-200 bg-white p-2">
          <div className="flex items-center gap-2 max-[360px]:flex-col max-[360px]:items-stretch">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type a message…"
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <div className="flex shrink-0 items-center gap-1.5 max-[360px]:justify-end">
              <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-slate-400 hover:text-slate-600"
                    aria-label="Insert emoji"
                  >
                    <Smile className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  side="top"
                  sideOffset={8}
                  className="w-auto border-0 bg-transparent p-0 shadow-none"
                >
                  <EmojiPicker
                    data={emojiData}
                    onEmojiSelect={(emoji: { native: string }) => {
                      insertEmoji(emoji.native);
                    }}
                    theme="light"
                    previewPosition="none"
                    skinTonePosition="search"
                    maxFrequentRows={1}
                    perLine={8}
                  />
                </PopoverContent>
              </Popover>
              <Button
                disabled={sending}
                onClick={() => void sendMessage()}
                className="h-8 gap-1.5 rounded-lg bg-[#0D1F45] px-3 text-sm hover:bg-[#162d5e] max-[360px]:w-full"
              >
                <SendHorizontal className="size-4" />
                {sending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </div>
      {/* ── Profile preview dialog ─────────────────────────────────────────── */}
      <Dialog open={previewContact !== null} onOpenChange={(open) => { if (!open) setPreviewContact(null); }}>
        <DialogContent className="max-w-xl">
          {previewContact && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="size-12 border border-slate-200">
                    <AvatarImage src={previewContact.avatarUrl ?? undefined} alt={`${previewContact.firstName} ${previewContact.lastName}`} />
                    <AvatarFallback className="bg-slate-100 text-sm font-semibold text-slate-700">
                      {initials(previewContact.firstName, previewContact.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <DialogTitle>{previewContact.firstName} {previewContact.lastName}</DialogTitle>
                    <DialogDescription className="text-xs uppercase tracking-wide">{previewContact.role}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3">
                {previewContact.profile.headline ? (
                  <p className="text-sm text-slate-700">{previewContact.profile.headline}</p>
                ) : null}
                {previewContact.profile.location ? (
                  <p className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="size-3" />
                    {previewContact.profile.location}
                  </p>
                ) : null}
                {previewContact.profile.bio ? (
                  <p className="text-sm text-slate-600">{previewContact.profile.bio}</p>
                ) : null}
                {previewContact.profile.skills.length > 0 ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {previewContact.profile.skills.map((skill) => (
                        <span key={skill} className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-900">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {previewContact.profile.experience.length > 0 ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Experience</p>
                    <div className="space-y-1 text-sm text-slate-600">
                      {previewContact.profile.experience.map((item) => (
                        <p key={`${item.company}-${item.title}`}>
                          {item.title} @ {item.company}{item.isCurrent ? " (Current)" : ""}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                {previewContact.profile.education.length > 0 ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Education</p>
                    <div className="space-y-1 text-sm text-slate-600">
                      {previewContact.profile.education.map((item) => (
                        <p key={`${item.school}-${item.degree}`}>
                          {item.degree} — {item.school}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                {(() => {
                  const links = previewContact.profile.links;
                  const link = links?.websiteUrl ?? links?.linkedinUrl ?? links?.githubUrl ?? links?.twitterUrl ?? null;
                  return link ? (
                    <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
                      View link <ExternalLink className="size-3" />
                    </a>
                  ) : null;
                })()}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

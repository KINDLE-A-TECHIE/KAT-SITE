"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type NotificationTypeValue = "INFO" | "SUCCESS" | "WARNING" | "ERROR";
type MessageStreamEvent =
  | {
      type: "connected";
      at: string;
    }
  | {
      type: "message_created";
      threadId: string;
      messageId: string;
      senderId: string;
      recipientId: string;
      recipientIds?: string[];
      createdAt: string;
    };

const STREAM_RETRY_MS = 3000;

type NotificationItem = {
  id: string;
  type: NotificationTypeValue;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};
type ParsedNotificationBody = {
  text: string;
  targetPath?: string;
  threadId?: string;
  messageId?: string;
};

function parseNotificationBody(raw: string): ParsedNotificationBody {
  try {
    const parsed = JSON.parse(raw) as Partial<ParsedNotificationBody>;
    if (parsed && typeof parsed === "object" && typeof parsed.text === "string") {
      return {
        text: parsed.text,
        targetPath: typeof parsed.targetPath === "string" ? parsed.targetPath : undefined,
        threadId: typeof parsed.threadId === "string" ? parsed.threadId : undefined,
        messageId: typeof parsed.messageId === "string" ? parsed.messageId : undefined,
      };
    }
  } catch {
    // Body can also be legacy plain text.
  }
  return { text: raw };
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function typeLabelClass(type: NotificationTypeValue) {
  if (type === "SUCCESS") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400";
  }
  if (type === "WARNING") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400";
  }
  if (type === "ERROR") {
    return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-400";
  }
  return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
}

export function NotificationsPopover() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const unreadCount = useMemo(() => notifications.length, [notifications]);

  const loadNotifications = useCallback(async (options?: { silent?: boolean }) => {
    const showLoading = !options?.silent;
    if (showLoading) {
      setLoading(true);
    }
    try {
      const response = await fetch("/api/notifications", {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        if (!options?.silent) {
          toast.error(payload?.error ?? "Could not load notifications.");
        }
        return;
      }
      const nextNotifications = ((payload.notifications ?? []) as NotificationItem[]).filter(
        (notification) => !notification.readAt,
      );
      setNotifications(nextNotifications);
      setHasLoadedOnce(true);
    } catch {
      if (!options?.silent) {
        toast.error("Could not load notifications.");
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadNotifications({ silent: true });
  }, [loadNotifications]);

  useEffect(() => {
    if (!open || !hasLoadedOnce) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadNotifications({ silent: true });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [open, hasLoadedOnce, loadNotifications]);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let unmounted = false;

    const connect = () => {
      eventSource = new EventSource("/api/messages/stream");

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as MessageStreamEvent;
          if (payload.type !== "message_created") {
            return;
          }
          void loadNotifications({ silent: true });
        } catch {
          // Ignore malformed payloads from stream.
        }
      };

      eventSource.onerror = () => {
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
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      eventSource?.close();
    };
  }, [loadNotifications]);

  const markOneAsRead = async (notificationId: string) => {
    const target = notifications.find((notification) => notification.id === notificationId);
    if (!target) {
      return false;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error ?? "Could not update notification.");
        return false;
      }
      setNotifications((prev) => prev.filter((notification) => notification.id !== notificationId));
      return true;
    } catch {
      toast.error("Could not update notification.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleNotificationClick = async (notification: NotificationItem) => {
    const parsed = parseNotificationBody(notification.body);
    const consumed = await markOneAsRead(notification.id);
    if (!consumed) {
      return;
    }

    setOpen(false);

    if (parsed.targetPath) {
      router.push(parsed.targetPath);
      return;
    }
    if (parsed.threadId) {
      router.push(`/dashboard/messages?threadId=${encodeURIComponent(parsed.threadId)}`);
      return;
    }
    if (/message/i.test(notification.title)) {
      router.push("/dashboard/messages");
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error ?? "Could not mark notifications as read.");
        return;
      }
      setNotifications([]);
    } catch {
      toast.error("Could not mark notifications as read.");
    } finally {
      setBusy(false);
    }
  };

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      void loadNotifications();
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Open notifications"
          className="relative rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 max-[360px]:p-1.5"
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} collisionPadding={12} className="w-[min(96vw,360px)] max-h-[70vh] overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700 max-[360px]:px-3">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{unreadCount} unread</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
              className="h-8 max-[360px]:px-2 max-[360px]:text-xs"
              onClick={() => void markAllAsRead()}
              disabled={busy || unreadCount === 0}
            >
            Mark all read
          </Button>
        </div>
        <div className="max-h-[calc(70vh-57px)] overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="space-y-2 p-4">
              <div className="h-16 animate-pulse rounded-md bg-slate-100 dark:bg-slate-700" />
              <div className="h-16 animate-pulse rounded-md bg-slate-100 dark:bg-slate-700" />
              <div className="h-16 animate-pulse rounded-md bg-slate-100 dark:bg-slate-700" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">No notifications yet.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 max-[360px]:px-3",
                    !notification.readAt ? "bg-cyan-50/40 dark:bg-cyan-900/20" : "bg-white dark:bg-transparent",
                  )}
                  onClick={() => void handleNotificationClick(notification)}
                  disabled={busy}
                >
                  {(() => {
                    const parsed = parseNotificationBody(notification.body);
                    return (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <p className="line-clamp-1 text-sm font-medium text-slate-900 dark:text-slate-100">{notification.title}</p>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", typeLabelClass(notification.type))}>
                            {notification.type}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">{parsed.text}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-[11px] text-slate-500 dark:text-slate-500">{formatTimestamp(notification.createdAt)}</p>
                          <span className="text-[11px] font-medium text-cyan-700 dark:text-cyan-400">New</span>
                        </div>
                      </>
                    );
                  })()}
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

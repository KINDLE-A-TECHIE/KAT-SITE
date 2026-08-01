"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type NotificationTypeValue = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

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
    // legacy plain text body
  }
  return { text: raw };
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleString(undefined, { month: "short", day: "numeric" });
}

const TYPE_CONFIG: Record<NotificationTypeValue, {
  Icon: React.ElementType;
  iconClass: string;
  bgClass: string;
  borderClass: string;
  label: string;
}> = {
  SUCCESS: {
    Icon: CheckCircle2,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-100 dark:bg-emerald-900/40",
    borderClass: "border-l-emerald-500",
    label: "Success",
  },
  WARNING: {
    Icon: AlertTriangle,
    iconClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-100 dark:bg-amber-900/40",
    borderClass: "border-l-amber-500",
    label: "Warning",
  },
  ERROR: {
    Icon: XCircle,
    iconClass: "text-rose-600 dark:text-rose-400",
    bgClass: "bg-rose-100 dark:bg-rose-900/40",
    borderClass: "border-l-rose-500",
    label: "Error",
  },
  INFO: {
    Icon: Info,
    iconClass: "text-orange-600 dark:text-orange-400",
    bgClass: "bg-orange-100 dark:bg-orange-900/40",
    borderClass: "border-l-orange-500",
    label: "Info",
  },
};

function NotificationSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-3.5">
      <div className="mt-0.5 h-8 w-8 shrink-0 animate-pulse rounded-full bg-stone-100 dark:bg-stone-700" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-stone-100 dark:bg-stone-700" />
        <div className="h-3 w-full animate-pulse rounded bg-stone-100 dark:bg-stone-700" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-stone-100 dark:bg-stone-700" />
      </div>
    </div>
  );
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
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        if (!options?.silent) toast.error(payload?.error ?? "Could not load notifications.");
        return;
      }
      const next = ((payload.notifications ?? []) as NotificationItem[]).filter(
        (n) => !n.readAt,
      );
      setNotifications(next);
      setHasLoadedOnce(true);
    } catch {
      if (!options?.silent) toast.error("Could not load notifications.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => { void loadNotifications({ silent: true }); }, [loadNotifications]);

  useEffect(() => {
    if (!open || !hasLoadedOnce) return;
    const interval = window.setInterval(() => void loadNotifications({ silent: true }), 60_000);
    return () => window.clearInterval(interval);
  }, [open, hasLoadedOnce, loadNotifications]);

  useEffect(() => {
    const handler = () => void loadNotifications({ silent: true });
    window.addEventListener("kat:message_created", handler);
    return () => window.removeEventListener("kat:message_created", handler);
  }, [loadNotifications]);

  const markOneAsRead = async (notificationId: string) => {
    if (!notifications.find((n) => n.id === notificationId)) return false;
    setBusy(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      const payload = await response.json();
      if (!response.ok) { toast.error(payload?.error ?? "Could not update notification."); return false; }
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
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
    if (!consumed) return;
    setOpen(false);
    if (parsed.targetPath) { router.push(parsed.targetPath); return; }
    if (parsed.threadId) { router.push(`/dashboard/messages?threadId=${encodeURIComponent(parsed.threadId)}`); return; }
    if (/message/i.test(notification.title)) router.push("/dashboard/messages");
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    setBusy(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      const payload = await response.json();
      if (!response.ok) { toast.error(payload?.error ?? "Could not mark notifications as read."); return; }
      setNotifications([]);
    } catch {
      toast.error("Could not mark notifications as read.");
    } finally {
      setBusy(false);
    }
  };

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) void loadNotifications();
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Open notifications"
          className={cn(
            "relative rounded-full border p-2 transition-all duration-150",
            "border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900",
            "dark:border-stone-800 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 dark:hover:text-stone-100",
            open && "bg-stone-50 dark:bg-stone-700",
          )}
        >
          <Bell className={cn("size-4 transition-transform duration-150", open && "scale-110")} />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 py-px text-[11px] font-bold leading-none text-white ring-2 ring-white dark:ring-stone-900">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className="w-[min(95vw,380px)] overflow-hidden p-0 shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1A1714]/10 dark:bg-orange-900/40">
              <Bell className="size-3.5 text-[#1A1714] dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">Notifications</p>
              {unreadCount > 0 && (
                <p className="text-[11px] leading-none text-stone-400 dark:text-stone-500">
                  {unreadCount} unread
                </p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllAsRead()}
              disabled={busy}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Body */}
        <div className="max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain bg-stone-50 dark:bg-stone-900/50">
          {loading ? (
            <div className="divide-y divide-stone-100 bg-white dark:divide-stone-800 dark:bg-stone-900">
              <NotificationSkeleton />
              <NotificationSkeleton />
              <NotificationSkeleton />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
                <Sparkles className="size-5 text-stone-400 dark:text-stone-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-stone-600 dark:text-stone-300">All caught up!</p>
                <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">No new notifications.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-stone-100 bg-white dark:divide-stone-800 dark:bg-stone-900">
              {notifications.map((notification) => {
                const cfg = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.INFO;
                const { Icon } = cfg;
                const parsed = parseNotificationBody(notification.body);
                const isUnread = !notification.readAt;

                return (
                  <button
                    type="button"
                    key={notification.id}
                    onClick={() => void handleNotificationClick(notification)}
                    disabled={busy}
                    className={cn(
                      "group w-full border-l-[3px] px-4 py-3.5 text-left transition-colors",
                      "hover:bg-stone-50 dark:hover:bg-stone-800/60",
                      "disabled:opacity-60",
                      isUnread
                        ? cfg.borderClass
                        : "border-l-transparent",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", cfg.bgClass)}>
                        <Icon className={cn("size-4", cfg.iconClass)} />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-1 text-sm font-semibold text-stone-900 dark:text-stone-100 group-hover:text-kat-clay dark:group-hover:text-orange-400">
                            {notification.title}
                          </p>
                          {isUnread && (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                          {parsed.text}
                        </p>
                        <p className="mt-1.5 text-[11px] font-medium text-stone-400 dark:text-stone-500">
                          {formatTimestamp(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-stone-100 bg-white px-4 py-2.5 dark:border-stone-800 dark:bg-stone-900">
            <p className="text-center text-[11px] text-stone-400 dark:text-stone-500">
              Click a notification to dismiss and navigate
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  MessageSquare,
  CheckCircle2,
  Clock,
  FolderPlus,
  UserPlus,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { notificationApi } from "@/lib/api-client";
import type { Notification, NotificationType } from "@/types";
import { formatDistanceToNow } from "date-fns";

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  TASK_ASSIGNED: <CheckCircle2 className="h-4 w-4 text-sky-500" />,
  TASK_UPDATED: <MessageSquare className="h-4 w-4 text-violet-500" />,
  WORK_LOG_SUBMITTED: <Clock className="h-4 w-4 text-amber-500" />,
  WORK_LOG_REVIEWED: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  PROJECT_CREATED: <FolderPlus className="h-4 w-4 text-blue-500" />,
  COMMENT: <MessageSquare className="h-4 w-4 text-indigo-500" />,
  INVITE: <UserPlus className="h-4 w-4 text-pink-500" />,
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationApi.list(),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  const items = notifications?.data ?? [];
  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            You have {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => markAllReadMutation.mutate()}
          disabled={unreadCount === 0 || markAllReadMutation.isPending}
        >
          <CheckCheck className="mr-2 h-4 w-4" />
          Mark all as read
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Notifications</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No notifications yet.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onMarkRead={() => markReadMutation.mutate(n.id)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: () => void;
}) {
  return (
    <li
      className={`flex items-start gap-3 p-4 transition-colors hover:bg-muted/30 ${
        !notification.isRead ? "bg-primary/5" : ""
      }`}
    >
      <div className="mt-0.5">{TYPE_ICON[notification.type]}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{notification.title}</p>
          {!notification.isRead && (
            <Badge variant="default" className="h-1.5 w-1.5 rounded-full p-0">
              <span className="sr-only">unread</span>
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {notification.message}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
          })}
        </p>
      </div>
      {!notification.isRead && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onMarkRead}
          className="text-xs"
        >
          <AlertCircle className="mr-1 h-3 w-3" />
          Mark read
        </Button>
      )}
    </li>
  );
}

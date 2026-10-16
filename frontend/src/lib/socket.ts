import { io, Socket } from "socket.io-client";
import { getToken } from "./api-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

let socketInstance: Socket | null = null;

/**
 * Returns a singleton Socket.IO client authenticated with the JWT.
 * The token is read lazily at connect time so logins in the same
 * browser session pick up the latest stored token.
 */
export function getSocket(): Socket {
  if (typeof window === "undefined") {
    throw new Error("getSocket() can only be called in the browser");
  }

  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }

  socketInstance = io(SOCKET_URL, {
    auth: (cb) => {
      const token = getToken();
      cb({ token: token ?? "" });
    },
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  return socketInstance;
}

/**
 * Event names used across the platform. Centralising them keeps
 * frontend/backend event contracts easy to keep in sync.
 */
export const SocketEvents = {
  TASK_UPDATED: "task:updated",
  TASK_CREATED: "task:created",
  TASK_DELETED: "task:deleted",
  WORK_LOG_SUBMITTED: "worklog:submitted",
  WORK_LOG_REVIEWED: "worklog:reviewed",
  NOTIFICATION: "notification",
  COMMENT_CREATED: "comment:created",
  PROJECT_UPDATED: "project:updated",
} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];

/** Disconnect and reset the singleton (used on logout). */
export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
  }
}

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { Socket } from "socket.io-client";
import { disconnectSocket, getSocket } from "@/lib/socket";
import { useAuth } from "@/lib/auth";

interface SocketContextValue {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

/**
 * Lazily connects the Socket.IO client once a user is authenticated and
 * tears the connection down on logout. Exposes the connected socket via
 * context so pages can subscribe to real-time events.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      socketRef.current = null;
      return;
    }

    const socket = getSocket();
    socketRef.current = socket;

    return () => {
      // Keep the singleton alive across re-renders; only disconnect on logout.
    };
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): Socket | null {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return ctx.socket;
}

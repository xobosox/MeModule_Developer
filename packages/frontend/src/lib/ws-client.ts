import { api } from "./api-client";
import type { WsMessage } from "./types";

type MessageHandler = (msg: WsMessage) => void;

export class WsClient {
  private projectId: string;
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private lastSeq = 0;
  private shouldReconnect = true;
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  async connect(): Promise<void> {
    this.shouldReconnect = true;
    const { ticket } = await api.getWsTicket(this.projectId);
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/projects/${this.projectId}/chat?ticket=${ticket}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      if (this.lastSeq > 0) {
        this.ws?.send(
          JSON.stringify({ type: "resume", lastSeq: this.lastSeq }),
        );
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        if (msg.seq !== undefined) {
          this.lastSeq = msg.seq;
        }
        this.handlers.forEach((handler) => handler(msg));
        this.reconnectDelay = 1000;
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      this.connect().catch(() => {
        // reconnect will be retried via onclose
      });
    }, this.reconnectDelay);
  }

  sendMessage(content: string): void {
    this.ws?.send(JSON.stringify({ type: "chat", content }));
  }

  sendFileEdit(path: string, content: string): void {
    this.ws?.send(JSON.stringify({ type: "file_edit", path, content }));
  }

  sendCancel(): void {
    this.ws?.send(JSON.stringify({ type: "cancel" }));
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}

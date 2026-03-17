import { v4 as uuidv4 } from "uuid";

interface TicketData {
  userId: string;
  projectId: string;
  expiresAt: number;
}

const tickets = new Map<string, TicketData>();

const TICKET_TTL_MS = 30_000; // 30 seconds

// Cleanup expired tickets every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of tickets) {
    if (data.expiresAt <= now) {
      tickets.delete(key);
    }
  }
}, 60_000).unref();

export function issueTicket(userId: string, projectId: string): string {
  const ticket = uuidv4();
  tickets.set(ticket, {
    userId,
    projectId,
    expiresAt: Date.now() + TICKET_TTL_MS,
  });
  return ticket;
}

export function consumeTicket(
  ticket: string
): { userId: string; projectId: string } | null {
  const data = tickets.get(ticket);
  if (!data) return null;

  tickets.delete(ticket);

  if (data.expiresAt <= Date.now()) return null;

  return { userId: data.userId, projectId: data.projectId };
}

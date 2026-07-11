import "server-only";
import { database } from "@/lib/db";

export type GameMessage = {
  id: number;
  senderUserId: number | null;
  senderName: string | null;
  recipientUserId: number;
  kind: "player" | "report";
  subject: string;
  body: string;
  readAt: string | null;
  savedAt: string | null;
  targetX: number | null;
  targetY: number | null;
  createdAt: string;
};

export type MessageRecipient = { id: number; displayName: string; username: string };

export function getInbox(userId: number, savedOnly = false) {
  return database.prepare(`
    SELECT m.id, m.sender_user_id AS senderUserId, u.display_name AS senderName, m.recipient_user_id AS recipientUserId,
      m.kind, m.subject, m.body, m.read_at AS readAt, m.saved_at AS savedAt, m.target_x AS targetX, m.target_y AS targetY, m.created_at AS createdAt
    FROM messages m
    LEFT JOIN users u ON u.id = m.sender_user_id
    WHERE m.recipient_user_id = ? ${savedOnly ? "AND m.saved_at IS NOT NULL" : ""}
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 60
  `).all(userId) as GameMessage[];
}

export function getUnreadMessageCount(userId: number) {
  const row = database.prepare("SELECT COUNT(*) AS count FROM messages WHERE recipient_user_id = ? AND read_at IS NULL").get(userId) as { count: number };
  return row.count;
}

export function getMessageRecipients(currentUserId: number) {
  return database.prepare(`
    SELECT id, display_name AS displayName, username
    FROM users
    WHERE id <> ?
    ORDER BY display_name COLLATE NOCASE
  `).all(currentUserId) as MessageRecipient[];
}

export function markInboxRead(userId: number) {
  database.prepare("UPDATE messages SET read_at = COALESCE(read_at, ?) WHERE recipient_user_id = ? AND read_at IS NULL").run(new Date().toISOString(), userId);
}

export function createSystemMessage(recipientUserId: number, subject: string, body: string, target?: { x: number; y: number }) {
  database.prepare("INSERT INTO messages(sender_user_id, recipient_user_id, kind, subject, body, target_x, target_y) VALUES(NULL, ?, 'report', ?, ?, ?, ?)").run(recipientUserId, subject, body, target?.x ?? null, target?.y ?? null);
}

export function createPlayerMessage(senderUserId: number, recipientUserId: number, subject: string, body: string) {
  database.prepare("INSERT INTO messages(sender_user_id, recipient_user_id, kind, subject, body) VALUES(?, ?, 'player', ?, ?)").run(senderUserId, recipientUserId, subject, body);
}

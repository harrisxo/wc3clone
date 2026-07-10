"use server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { database } from "@/lib/db";
import { createPlayerMessage } from "@/lib/messages";

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export async function sendPlayerMessage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.race) redirect("/");

  const recipientId = Number(formData.get("recipientId"));
  const subject = cleanText(formData.get("subject"), 80);
  const body = String(formData.get("body") ?? "").trim().slice(0, 2000);

  const recipient = Number.isInteger(recipientId)
    ? database.prepare("SELECT id FROM users WHERE id = ? AND id <> ?").get(recipientId, user.id) as { id: number } | undefined
    : undefined;

  if (!recipient || subject.length < 2 || body.length < 2) redirect("/game?view=nachrichten&notice=invalid");

  createPlayerMessage(user.id, recipient.id, subject, body);
  redirect("/game?view=nachrichten&notice=sent");
}
export async function deleteMessage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.race) redirect("/");

  const messageId = Number(formData.get("messageId"));
  if (!Number.isInteger(messageId)) redirect("/game?view=nachrichten&notice=invalid");

  database.prepare("DELETE FROM messages WHERE id = ? AND recipient_user_id = ?").run(messageId, user.id);
  redirect("/game?view=nachrichten");
}


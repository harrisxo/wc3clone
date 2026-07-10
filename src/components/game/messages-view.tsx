import Link from "next/link";
import { deleteMessage, sendPlayerMessage } from "@/lib/actions/messages";
import type { GameMessage, MessageRecipient } from "@/lib/messages";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function replySubject(subject: string) {
  return subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`;
}

export function MessagesView({ messages, recipients, replyToId, replySubjectText }: { messages: GameMessage[]; recipients: MessageRecipient[]; replyToId: number | null; replySubjectText: string }) {
  const selectedRecipientName = replyToId ? recipients.find((recipient) => recipient.id === replyToId)?.displayName ?? messages.find((message) => message.senderUserId === replyToId)?.senderName ?? "Unbekannt" : null;
  const visibleRecipients = selectedRecipientName && replyToId && !recipients.some((recipient) => recipient.id === replyToId)
    ? [{ id: replyToId, displayName: selectedRecipientName, username: selectedRecipientName }, ...recipients]
    : recipients;
  const selectedRecipient = replyToId ? String(replyToId) : "";

  return <div className="messages-view">
    <section className="messages-inbox">
      <div className="messages-intro"><p className="section-kicker">Posteingang</p><h2>Berichte und Briefe</h2><p>Hier landen Kampfberichte und Nachrichten von anderen Spielern.</p></div>
      {messages.length === 0
        ? <p className="messages-empty">Noch keine Nachrichten vorhanden.</p>
        : <div className="message-list">{messages.map((message) => {
          const canReply = message.kind === "player" && message.senderUserId !== null;
          const replyHref = canReply ? `/game?view=nachrichten&replyTo=${message.senderUserId}&replySubject=${encodeURIComponent(replySubject(message.subject))}` : null;
          return <article className={`message-card message-${message.kind}${message.readAt ? "" : " unread"}`} key={message.id}>
            <header><span>{message.kind === "report" ? "Kampfbericht" : message.senderName ?? "Unbekannt"}</span><time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time></header>
            <h3>{message.subject}</h3>
            <p>{message.body}</p>
            <div className="message-actions">
              {replyHref && <Link className="message-reply" href={replyHref}>Antworten</Link>}
              <form action={deleteMessage}><input type="hidden" name="messageId" value={message.id} /><button className="message-delete" type="submit">Löschen</button></form>
            </div>
          </article>;
        })}</div>}
    </section>
    <aside className="message-compose" id="antworten">
      <p className="section-kicker">{selectedRecipient ? "Antwort schreiben" : "Nachricht schreiben"}</p>
      {selectedRecipientName && <div className="reply-target"><span>Antwort an</span><strong>{selectedRecipientName}</strong></div>}
      <form action={sendPlayerMessage} key={`compose-${selectedRecipient}-${replySubjectText}`}>
        {replyToId && selectedRecipientName
          ? <><div className="reply-target"><span>{"Empf\u00e4nger"}</span><strong>{selectedRecipientName}</strong></div><input type="hidden" name="recipientId" value={selectedRecipient} /></>
          : <label>{"Empf\u00e4nger"}<select name="recipientId" required defaultValue="">
              <option value="" disabled>{"Spieler ausw\u00e4hlen"}</option>
              {visibleRecipients.map((recipient) => <option value={recipient.id} key={recipient.id}>{recipient.displayName}</option>)}
            </select></label>}
        <label>Betreff<input name="subject" maxLength={80} minLength={2} required placeholder="Kurzer Betreff" defaultValue={replySubjectText} /></label>
        <label>Nachricht<textarea name="body" maxLength={2000} minLength={2} required rows={8} placeholder="Deine Nachricht" /></label>
        <button type="submit" disabled={replyToId ? !selectedRecipientName : visibleRecipients.length === 0}>Senden</button>
      </form>
      {recipients.length === 0 && <p className="message-compose-note">{"Es gibt noch keinen anderen Spieler mit gew\u00e4hlter Rasse."}</p>}
    </aside>
  </div>;
}






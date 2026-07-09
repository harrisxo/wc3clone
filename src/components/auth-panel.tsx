"use client";

import { useActionState, useState } from "react";
import { login, register, type AuthState } from "@/lib/actions/auth";

const initialState: AuthState = {};

export function AuthPanel() {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [registerState, registerAction, registerPending] = useActionState(register, initialState);
  const [loginState, loginAction, loginPending] = useActionState(login, initialState);
  const state = mode === "register" ? registerState : loginState;
  const pending = registerPending || loginPending;

  return <>
    <div className="auth-tabs" role="tablist" aria-label="Kontozugang">
      <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => setMode("register")}>Registrieren</button>
      <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")}>Einloggen</button>
    </div>
    <div className="auth-content">
      <div className="auth-heading">
        <p className="eyebrow">{mode === "register" ? "Deine Reise beginnt" : "Zurück an die Front"}</p>
        <h2>{mode === "register" ? "Konto erstellen" : "Willkommen zurück"}</h2>
        <p>{mode === "register" ? "Sichere dir deinen Namen für die kommende Welt." : "Melde dich mit deinem Feldherrennamen oder deiner E-Mail an."}</p>
      </div>
      <form className="auth-form" action={mode === "register" ? registerAction : loginAction}>
        {mode === "register" && <><label htmlFor="username">Loginname</label><input id="username" name="username" type="text" minLength={3} maxLength={24} autoComplete="username" required placeholder="Dein Loginname" /><label htmlFor="displayName">Öffentlicher Spielername</label><input id="displayName" name="displayName" type="text" minLength={3} maxLength={24} required placeholder="Wird auf der Karte angezeigt" /></>}
        <label htmlFor="identifier">{mode === "register" ? "E-Mail-Adresse" : "Name oder E-Mail"}</label>
        <input id="identifier" name={mode === "register" ? "email" : "identifier"} type={mode === "register" ? "email" : "text"} autoComplete={mode === "register" ? "email" : "username"} required placeholder={mode === "register" ? "name@beispiel.de" : "Eisenwolf"} />
        <label htmlFor="password">Passwort</label>
        <input id="password" name="password" type="password" minLength={8} maxLength={128} autoComplete={mode === "register" ? "new-password" : "current-password"} required placeholder="Mindestens 8 Zeichen" />
        {state.error && <p className="form-error" role="alert">{state.error}</p>}
        <button className="primary-button" type="submit" disabled={pending}>{pending ? "Einen Moment …" : mode === "register" ? "Konto erstellen" : "Einloggen"}</button>
      </form>
      <p className="fine-print">Mit der Registrierung erklärst du dich mit den zukünftigen Spielregeln einverstanden.</p>
    </div>
  </>;
}


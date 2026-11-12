"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/browser";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const supabase = createClient();

  if (!supabase) {
    return (
      <Alert>
        <AlertDescription>Sign-in is not set up on this server yet (Supabase keys missing).</AlertDescription>
      </Alert>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    setBusy(true);
    setMessage(null);
    if (mode === "signin") {
      const { error } = await supabase!.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setMessage({ kind: "error", text: "Email or password is not correct." });
      router.replace(next);
      router.refresh();
    } else {
      const { error } = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
      setBusy(false);
      if (error) return setMessage({ kind: "error", text: "Could not create the account. Use a valid email and a password of at least 8 characters." });
      setMessage({ kind: "info", text: "Check your email to confirm the account, then sign in." });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-describedby={message ? "login-message" : undefined}>
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} required />
      </div>
      {message && (
        <Alert id="login-message" variant={message.kind === "error" ? "destructive" : "default"} role={message.kind === "error" ? "alert" : "status"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {mode === "signin" ? "New to INKLOOM?" : "Already have an account?"}{" "}
        <button type="button" className="font-medium text-foreground underline underline-offset-4" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(null); }}>
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </form>
  );
}

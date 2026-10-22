"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { browserSupabase } from "@/lib/supabase/browser";
import { removeStorage } from "@/lib/browser-storage";
import { supabaseConfigured } from "@/lib/supabase/config";
import { X, ArrowRight, LoaderCircle, Mail } from "lucide-react";
const Context = createContext<{
  user: User | null;
  openAuth: () => void;
  signOut: () => Promise<void>;
}>({ user: null, openAuth: () => {}, signOut: async () => {} });
export const useAuth = () => useContext(Context);
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [open, setOpen] = useState(false),
    [mode, setMode] = useState<"signin" | "signup" | "reset" | "update">(
      "signin",
    );
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const account = useRef<string | null | undefined>(undefined);
  const configured = supabaseConfigured();
  useEffect(() => {
    if (!supabaseConfigured()) return;
    const client = browserSupabase();
    client.auth
      .getUser()
      .then(({ data }) => {
        account.current = data.user?.id || null;
        setUser(data.user);
      })
      .catch(() => {
        account.current = null;
      });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      const nextAccount = session?.user.id || null;
      if (
        ["SIGNED_IN", "SIGNED_OUT"].includes(event) &&
        account.current !== undefined &&
        account.current !== nextAccount
      ) {
        if (account.current) {
          removeStorage("yanco-brief");
          removeStorage("yanco-studio-auth-draft");
        }
        location.reload();
        return;
      }
      account.current = nextAccount;
      setUser(session?.user || null);
      if (event === "PASSWORD_RECOVERY") {
        setMode("update");
        setOpen(true);
      }
    });
    queueMicrotask(() => {
      const query = new URLSearchParams(location.search);
      if (query.has("recovery")) {
        setMode("update");
        setOpen(true);
      }
      if (query.has("authError")) {
        setMessage(query.get("authError")!);
        setOpen(true);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    try {
      const client = browserSupabase();
      if (mode === "signin") {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setOpen(false);
        location.reload();
      } else if (mode === "signup") {
        const { error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (error) throw error;
        setMessage(
          "Check your email to confirm your account, then return here to sign in.",
        );
      } else if (mode === "reset") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/auth/callback?next=/?recovery=1`,
        });
        if (error) throw error;
        setMessage(
          "If an account exists, a password reset link is on its way.",
        );
      } else {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        setMessage("Password updated. You can continue exploring.");
        setMode("signin");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Context.Provider
      value={{
        user,
        openAuth: () => {
          setMode("signin");
          setMessage(
            configured
              ? ""
              : "Account services are temporarily unavailable. You can still browse and save starter scenes on this device.",
          );
          setOpen(true);
        },
        signOut: async () => {
          await browserSupabase().auth.signOut();
          removeStorage("yanco-brief");
          removeStorage("yanco-studio-auth-draft");
          setUser(null);
          location.reload();
        },
      }}
    >
      {children}
      <dialog
        ref={dialog}
        className="auth-dialog"
        onCancel={() => setOpen(false)}
        aria-labelledby="auth-title"
      >
        <button
          className="icon-button dialog-close"
          aria-label="Close sign in"
          onClick={() => setOpen(false)}
        >
          <X size={21} />
        </button>
        <span className="eyebrow">YOUR YANCO WORKSPACE</span>
        <h2 id="auth-title">
          {mode === "signup"
            ? "A place for your ideas."
            : mode === "reset"
              ? "Let’s get you back in."
              : mode === "update"
                ? "A fresh password."
                : "Welcome to the table."}
        </h2>
        <p>
          Save your settings, upload your menu, and see your dishes on Yanco
          dinnerware.
        </p>
        <form onSubmit={submit} className="auth-form">
          {mode !== "update" && (
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>
          )}
          {mode !== "reset" && (
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={mode === "signin" ? 1 : 8}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                required
                placeholder={
                  mode === "signin" ? "Your password" : "At least 8 characters"
                }
              />
            </label>
          )}
          {message && (
            <p className="notice" role="status">
              <Mail size={18} />
              {message}
            </p>
          )}
          <button className="button primary" disabled={busy || !configured}>
            {busy ? <LoaderCircle className="spin" size={18} /> : null}
            {mode === "signup"
              ? "Create account"
              : mode === "reset"
                ? "Send reset link"
                : mode === "update"
                  ? "Update password"
                  : "Sign in"}
            <ArrowRight size={18} />
          </button>
        </form>
        <div className="auth-links">
          <button
            onClick={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setMessage("");
            }}
          >
            {mode === "signup"
              ? "Already have an account? Sign in"
              : "New here? Create an account"}
          </button>
          <button
            onClick={() => {
              setMode("reset");
              setMessage("");
            }}
          >
            Forgot password?
          </button>
        </div>
      </dialog>
    </Context.Provider>
  );
}

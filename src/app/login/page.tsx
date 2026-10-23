
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Sparkles,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";

function getDisplayName(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const metadata = user.user_metadata ?? {};
  const name =
    metadata.full_name ??
    metadata.name;

  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }

  return user.email?.split("@")[0] || "Planora user";
}

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function checkSession() {
      try {
        const { data, error: userError } = await supabase.auth.getUser();

        if (!active) return;

        if (!userError && data.user) {
          setCurrentEmail(data.user.email ?? null);
          setCurrentName(getDisplayName(data.user));
        }

        const params = new URLSearchParams(window.location.search);

        if (params.get("error") === "confirmation_failed") {
          setError(
            "Email confirmation could not be completed. Please try registering again or sign in."
          );
        }
      } catch {
        if (active) {
          setError("Unable to check your session. Please refresh the page.");
        }
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      const user = session?.user;

      setCurrentEmail(user?.email ?? null);
      setCurrentName(user ? getDisplayName(user) : "");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  function safeDestination() {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("next");

    if (
      requested &&
      requested.startsWith("/") &&
      !requested.startsWith("//")
    ) {
      return requested;
    }

    return "/";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fullName.trim();

    if (mode === "signup" && normalizedName.length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: normalizedName,
              name: normalizedName,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (authError) throw authError;

        if (data.session) {
          setMessage("Your account has been created. Opening Planora...");
          router.replace("/");
          router.refresh();
        } else {
          setMessage(
            `Thanks, ${normalizedName}! Your registration has been received. Check ${normalizedEmail} for the confirmation email, then sign in.`
          );
        }
      } else {
        const { error: authError } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

        if (authError) throw authError;

        setMessage("Signed in successfully. Opening your workspace...");
        router.replace(safeDestination());
        router.refresh();
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Authentication failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signOut();

      if (authError) throw authError;

      setCurrentEmail(null);
      setCurrentName("");
      setPassword("");
      setMessage("You have signed out successfully.");
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to sign out. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F6F1] px-4 py-10 text-[#202820]">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[#E2E8DE] bg-white shadow-xl lg:grid-cols-2">
        <section className="flex flex-col justify-between bg-[#172922] p-8 text-white sm:p-10 lg:p-12">
          <div>
            <a href="/" className="inline-flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#D6F379] text-[#172922]">
                <Sparkles size={24} />
              </span>
              <span>
                <span className="block text-xl font-bold">Planora</span>
                <span className="block text-[10px] tracking-[0.2em] text-[#B9C8BE]">
                  AI EVENT PLANNER
                </span>
              </span>
            </a>

            <div className="mt-16 max-w-md">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-[#D6F379]">
                <Sparkles size={14} />
                YOUR MOMENTS, ORGANIZED
              </div>

              <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Celebrate more.
                <br />
                <span className="text-[#D6F379]">Stress less.</span>
              </h1>

              <p className="mt-5 text-sm leading-7 text-[#C1CEC4]">
                Bring every event idea, budget, task and AI-generated plan
                together in one thoughtfully organized workspace.
              </p>

              <div className="mt-9 space-y-4">
                {[
                  "Personalized plans powered by AI",
                  "Budgets and preparation checklists",
                  "Your own account and planning workspace",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle2
                      size={18}
                      className="shrink-0 text-[#D6F379]"
                    />
                    <span className="text-sm text-[#E0E8E1]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-12 text-xs text-[#91A69A]">
            Planora AI · Thoughtful planning, beautiful moments.
          </p>
        </section>

        <section className="p-6 sm:p-10 lg:p-12">
          <div className="mx-auto max-w-md">
            {checkingSession ? (
              <div className="flex min-h-[350px] flex-col items-center justify-center text-center">
                <LoaderCircle
                  size={30}
                  className="animate-spin text-[#718A56]"
                />
                <p className="mt-4 text-sm text-[#7D877B]">
                  Checking your account...
                </p>
              </div>
            ) : currentEmail ? (
              <div className="py-10">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF4E5] text-[#69814F]">
                  <UserRound size={28} />
                </div>

                <h2 className="mt-6 text-2xl font-semibold">
                  Welcome, {currentName || "Planora user"}
                </h2>

                <p className="mt-3 break-all text-sm text-[#6F7B6C]">
                  {currentEmail}
                </p>

                <a
                  href="/"
                  className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-[#172922] px-5 py-3.5 text-sm font-semibold text-white hover:bg-[#294438]"
                >
                  Open dashboard <ArrowRight size={17} />
                </a>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSignOut}
                  className="mt-3 w-full rounded-xl border border-[#DDE3D8] px-5 py-3 text-sm font-semibold text-[#4B5948] hover:bg-[#F6F8F3] disabled:opacity-60"
                >
                  {loading ? "Signing out..." : "Sign out"}
                </button>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    {mode === "signin"
                      ? "Welcome back"
                      : "Create your account"}
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-[#7D877B]">
                    {mode === "signin"
                      ? "Sign in to access your Planora workspace."
                      : "Add your name and create your Planora account."}
                  </p>
                </div>

                <div className="mb-6 grid grid-cols-2 rounded-xl bg-[#F0F3EC] p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setError("");
                      setMessage("");
                    }}
                    className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                      mode === "signin"
                        ? "bg-white text-[#26352A] shadow-sm"
                        : "text-[#7D877B] hover:text-[#26352A]"
                    }`}
                  >
                    Sign in
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setError("");
                      setMessage("");
                    }}
                    className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                      mode === "signup"
                        ? "bg-white text-[#26352A] shadow-sm"
                        : "text-[#7D877B] hover:text-[#26352A]"
                    }`}
                  >
                    Create account
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {mode === "signup" && (
                    <div>
                      <label
                        htmlFor="fullName"
                        className="mb-2 block text-sm font-medium"
                      >
                        Full name
                      </label>

                      <div className="relative">
                        <UserRound
                          size={18}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#879084]"
                        />

                        <input
                          id="fullName"
                          type="text"
                          required
                          minLength={2}
                          maxLength={80}
                          autoComplete="name"
                          value={fullName}
                          onChange={(event) =>
                            setFullName(event.target.value)
                          }
                          placeholder="Enter your full name"
                          className="w-full rounded-xl border border-[#DDE3D8] py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-[#8DAA68] focus:ring-2 focus:ring-[#D6F379]/40"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-medium"
                    >
                      Email address
                    </label>

                    <div className="relative">
                      <Mail
                        size={18}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#879084]"
                      />

                      <input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-[#DDE3D8] py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-[#8DAA68] focus:ring-2 focus:ring-[#D6F379]/40"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="mb-2 block text-sm font-medium"
                    >
                      Password
                    </label>

                    <div className="relative">
                      <LockKeyhole
                        size={18}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#879084]"
                      />

                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        autoComplete={
                          mode === "signin"
                            ? "current-password"
                            : "new-password"
                        }
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full rounded-xl border border-[#DDE3D8] py-3.5 pl-11 pr-12 text-sm outline-none transition focus:border-[#8DAA68] focus:ring-2 focus:ring-[#D6F379]/40"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#7D877B] hover:bg-[#F0F3EC]"
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800"
                    >
                      {error}
                    </div>
                  )}

                  {message && (
                    <div
                      role="status"
                      className="rounded-xl border border-[#DCE8C4] bg-[#F0F8E4] p-3 text-sm leading-6 text-[#35512B]"
                    >
                      {message}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#172922] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#294438] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <LoaderCircle
                          size={18}
                          className="animate-spin"
                        />
                        Please wait...
                      </>
                    ) : (
                      <>
                        {mode === "signin"
                          ? "Sign in to Planora"
                          : "Create my account"}
                        <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-7 rounded-xl bg-[#F6F8F3] p-4">
                  <div className="flex items-start gap-3">
                    <CalendarDays
                      size={18}
                      className="mt-0.5 shrink-0 text-[#69814F]"
                    />
                    <p className="text-xs leading-5 text-[#72806D]">
                      Your name is saved with your account. Your existing
                      browser-saved events remain on this computer while we
                      finish connecting cloud storage.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

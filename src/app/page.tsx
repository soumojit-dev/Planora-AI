"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  Cake,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ClipboardCheck,
  Compass,
  ExternalLink,
  Heart,
  LayoutDashboard,
  Lightbulb,
  Link2,
  LoaderCircle,
  LogOut,
  MapPin,
  PartyPopper,
  Pencil,
  Plus,
  Save,
  Sparkles,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  loadAndSyncPlanoraData,
  saveEventAndTasksToCloud,
  type EventType,
  type PlanoraEvent,
} from "@/lib/planora-cloud";

type EventRecord = PlanoraEvent;

type SavedPlanReference = {
  id: string;
  eventId: string | null;
  eventName: string;
  plan: string;
  savedAt: string;
};

const EVENT_STORAGE_KEY = "planora-events-v1";
const PLAN_STORAGE_KEY = "planora-ai-plans-v1";

const eventTypes: {
  name: EventType;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    name: "Wedding",
    description: "Make the big day unforgettable.",
    icon: Heart,
  },
  {
    name: "Birthday",
    description: "Create a celebration worth remembering.",
    icon: Cake,
  },
  {
    name: "Community Event",
    description: "Bring people together beautifully.",
    icon: PartyPopper,
  },
];

const budgetCategories = [
  { name: "Venue & space", percentage: 30 },
  { name: "Food & catering", percentage: 25 },
  { name: "Decorations", percentage: 15 },
  { name: "Photography", percentage: 10 },
  { name: "Entertainment", percentage: 8 },
  { name: "Other expenses", percentage: 12 },
];

const planningTasks: Record<EventType, string[]> = {
  Wedding: [
    "Set wedding budget",
    "Shortlist and book venue",
    "Prepare guest list",
    "Research catering and decoration vendors",
    "Plan ceremony and reception timeline",
    "Confirm final arrangements",
  ],
  Birthday: [
    "Choose party theme",
    "Prepare guest list",
    "Book venue or choose a location",
    "Arrange cake, food and decorations",
    "Plan activities and entertainment",
    "Confirm invitations and supplies",
  ],
  "Community Event": [
    "Define event goals and budget",
    "Shortlist venue and obtain permissions",
    "Organize volunteers",
    "Contact vendors and sponsors",
    "Prepare program and activity schedule",
    "Confirm logistics and safety arrangements",
  ],
};

function isEventType(value: unknown): value is EventType {
  return (
    value === "Wedding" ||
    value === "Birthday" ||
    value === "Community Event"
  );
}

function isEventRecord(value: unknown): value is EventRecord {
  if (typeof value !== "object" || value === null) return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    isEventType(item.type) &&
    typeof item.date === "string" &&
    typeof item.location === "string" &&
    typeof item.guests === "number" &&
    Number.isFinite(item.guests) &&
    typeof item.budget === "number" &&
    Number.isFinite(item.budget) &&
    Array.isArray(item.tasks) &&
    item.tasks.every(
      (task) =>
        typeof task === "object" &&
        task !== null &&
        typeof (task as Record<string, unknown>).id === "string" &&
        typeof (task as Record<string, unknown>).title === "string" &&
        typeof (task as Record<string, unknown>).done === "boolean"
    )
  );
}

function isSavedPlanReference(
  value: unknown
): value is SavedPlanReference {
  if (typeof value !== "object" || value === null) return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    (typeof item.eventId === "string" || item.eventId === null) &&
    typeof item.eventName === "string" &&
    typeof item.plan === "string" &&
    typeof item.savedAt === "string"
  );
}

function getDisplayName(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const metadata = user.user_metadata ?? {};
  const value = metadata.full_name ?? metadata.name;

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return user.email?.split("@")[0] || "Planora user";
}

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string) {
  if (!date) return "Date not set";

  return new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Home() {
  const router = useRouter();

  const [events, setEvents] = useState<EventRecord[]>([]);
  const [linkedPlans, setLinkedPlans] = useState<
    Record<string, SavedPlanReference>
  >({});
  const [eventsLoaded, setEventsLoaded] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEventType, setSelectedEventType] =
    useState<EventType>("Wedding");
  const [activeNav, setActiveNav] = useState("Overview");
  const [notice, setNotice] = useState("");

  const [accountName, setAccountName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [form, setForm] = useState({
    name: "",
    type: "Wedding" as EventType,
    date: "",
    location: "",
    guests: "50",
    budget: "50000",
  });

  // Load the signed-in user's cloud workspace and import legacy local data.
  useEffect(() => {
    let active = true;

    async function restoreWorkspace() {
      try {
        const synced = await loadAndSyncPlanoraData();

        if (!active) return;

        setEvents(synced.events);

        const latestByEvent: Record<string, SavedPlanReference> = {};

        // loadAndSyncPlanoraData returns saved plans newest first.
        for (const plan of synced.plans) {
          if (plan.eventId && !latestByEvent[plan.eventId]) {
            latestByEvent[plan.eventId] = {
              id: plan.id,
              eventId: plan.eventId,
              eventName: plan.eventName,
              plan: plan.plan,
              savedAt: plan.savedAt,
            };
          }
        }

        setLinkedPlans(latestByEvent);
      } catch (error) {
        console.error("Planora cloud synchronization failed.", error);

        if (!active) return;

        // Keep available local data visible if cloud access is temporarily unavailable.
        // The cloud helper switches the active cache when accounts change.
        try {
          const eventsRaw = window.localStorage.getItem(EVENT_STORAGE_KEY);
          const plansRaw = window.localStorage.getItem(PLAN_STORAGE_KEY);

          if (eventsRaw) {
            const parsed: unknown = JSON.parse(eventsRaw);

            if (Array.isArray(parsed)) {
              setEvents(parsed.filter(isEventRecord));
            }
          }

          if (plansRaw) {
            const parsed: unknown = JSON.parse(plansRaw);

            if (Array.isArray(parsed)) {
              const plans = parsed.filter(isSavedPlanReference);
              const latestByEvent: Record<string, SavedPlanReference> = {};

              for (const plan of plans) {
                if (plan.eventId && !latestByEvent[plan.eventId]) {
                  latestByEvent[plan.eventId] = plan;
                }
              }

              setLinkedPlans(latestByEvent);
            }
          }
        } catch (localError) {
          console.error("Planora could not restore its browser cache.", localError);
        }

        setNotice(
          "Cloud synchronization failed. Available local data is shown, but new changes may not be synced."
        );
      } finally {
        if (active) setEventsLoaded(true);
      }
    }

    void restoreWorkspace();

    return () => {
      active = false;
    };
  }, []);

  // Maintain browser caching as a convenience for reloads and offline fallback.
  useEffect(() => {
    if (!eventsLoaded) return;

    try {
      window.localStorage.setItem(
        EVENT_STORAGE_KEY,
        JSON.stringify(events)
      );
    } catch (error) {
      console.error("Planora could not cache events locally.", error);
      setNotice(
        "Your browser could not cache the latest event changes. Check available storage."
      );
    }
  }, [events, eventsLoaded]);

  // Load profile details from Supabase Auth.
  useEffect(() => {
    let active = true;
    const supabase = createSupabaseClient();

    function applyUser(
      user: {
        email?: string;
        user_metadata?: Record<string, unknown>;
      } | null
    ) {
      if (!active) return;

      if (!user) {
        setAccountName("");
        setAccountEmail("");
        setProfileNameDraft("");
        return;
      }

      const name = getDisplayName(user);

      setAccountName(name);
      setAccountEmail(user.email ?? "");
      setProfileNameDraft(name);
    }

    async function loadUser() {
      try {
        const { data, error } = await supabase.auth.getUser();

        if (!active) return;

        if (error) {
          console.error("Could not load the signed-in user.", error);
          return;
        }

        applyUser(data.user);
      } catch (error) {
        console.error("Could not load the signed-in user.", error);
      } finally {
        if (active) setAuthLoading(false);
      }
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const totalBudget = events.reduce(
    (total, event) => total + event.budget,
    0
  );

  const allTasks = events.flatMap((event) =>
    event.tasks.map((task) => ({
      ...task,
      eventId: event.id,
      eventName: event.name,
    }))
  );

  const completedTasks = allTasks.filter((task) => task.done).length;
  const pendingTasks = allTasks.length - completedTasks;

  const nextEvent = [...events]
    .filter((event) => event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  function openCreateModal(type?: EventType) {
    const eventType = type ?? selectedEventType;

    setSelectedEventType(eventType);
    setForm((previous) => ({ ...previous, type: eventType }));
    setNotice("");
    setModalOpen(true);
  }

  function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!eventsLoaded) {
      setNotice("Your workspace is still loading. Please try again shortly.");
      return;
    }

    const newEvent: EventRecord = {
      id: `${Date.now()}`,
      name: form.name.trim(),
      type: form.type,
      date: form.date,
      location: form.location.trim(),
      guests: Number(form.guests),
      budget: Number(form.budget),
      tasks: planningTasks[form.type].map((title, index) => ({
        id: `${Date.now()}-${index}`,
        title,
        done: false,
      })),
    };

    setEvents((previous) => [...previous, newEvent]);
    setSelectedEventType(form.type);
    setModalOpen(false);
    setActiveNav("Overview");
    setNotice(`"${newEvent.name}" was added. Saving it to your cloud workspace...`);

    setForm({
      name: "",
      type: newEvent.type,
      date: "",
      location: "",
      guests: "50",
      budget: "50000",
    });

    void saveEventAndTasksToCloud(newEvent)
      .then(() => {
        setNotice(`"${newEvent.name}" is saved to your cloud workspace.`);
      })
      .catch((error) => {
        console.error("Planora could not sync the new event.", error);
        setNotice(
          `The event is cached locally, but cloud synchronization failed: ${
            error instanceof Error ? error.message : "Please try again."
          }`
        );
      });
  }

  function toggleTask(eventId: string, taskId: string) {
    const currentEvent = events.find((event) => event.id === eventId);

    if (!currentEvent) return;

    const updatedEvent: EventRecord = {
      ...currentEvent,
      tasks: currentEvent.tasks.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task
      ),
    };

    setEvents((previous) =>
      previous.map((event) =>
        event.id === eventId ? updatedEvent : event
      )
    );

    void saveEventAndTasksToCloud(updatedEvent).catch((error) => {
      console.error("Planora could not sync checklist progress.", error);

      setNotice(
        `Checklist progress is cached locally, but cloud synchronization failed: ${
          error instanceof Error ? error.message : "Please try again."
        }`
      );
    });
  }

  async function saveProfileName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const newName = profileNameDraft.trim();

    if (newName.length < 2 || newName.length > 80) {
      setNotice("Your display name must be between 2 and 80 characters.");
      return;
    }

    setSavingProfile(true);
    setNotice("");

    try {
      const supabase = createSupabaseClient();

      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: newName,
          name: newName,
        },
      });

      if (error) throw error;

      const savedName = data.user
        ? getDisplayName(data.user)
        : newName;

      setAccountName(savedName);
      setProfileNameDraft(savedName);
      setIsEditingProfile(false);
      setNotice("Your profile name has been updated.");
    } catch (error) {
      console.error("Planora could not update the profile name.", error);

      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to update your profile name. Please try again."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSignOut() {
    setLoggingOut(true);
    setNotice("");

    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Planora sign-out failed.", error);

      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to sign out. Please try again."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  const navigation = [
    { label: "Overview", icon: LayoutDashboard, href: "#overview" },
    { label: "My Events", icon: CalendarDays, href: "#events" },
    { label: "Budget Planner", icon: Wallet, href: "#budget" },
    { label: "Timeline", icon: Clock3, href: "#timeline" },
    { label: "Vendors & Tasks", icon: ClipboardCheck, href: "#tasks" },
    { label: "AI Planner", icon: Sparkles, href: "/ai-planner" },
    { label: "Ideas & Inspiration", icon: Lightbulb, href: "#ideas" },
  ];

  return (
    <main className="min-h-screen bg-[#F7F8F6] text-[#202820]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-y-auto border-r border-white/10 bg-[#172922] text-white lg:flex">
        <div className="flex items-center gap-3 px-6 py-7">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#D6F379] text-[#172922]">
            <Sparkles size={23} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Planora</h1>
            <p className="text-xs tracking-widest text-[#B9C8BE]">
              AI EVENT PLANNER
            </p>
          </div>
        </div>

        <div className="px-5 pb-3 pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#91A69A]">
          Workspace
        </div>

        <nav className="flex flex-col gap-1 px-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.label;

            return (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setActiveNav(item.label)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                  isActive
                    ? "bg-[#D6F379] font-semibold text-[#172922]"
                    : "text-[#C0CDC4] hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {item.label}

                {item.label === "AI Planner" && (
                  <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[9px]">
                    AI
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 p-4">
          <section
            aria-label="Account and sign out"
            className="rounded-2xl border border-white/15 bg-white/[0.07] p-3"
          >
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D6F379] text-sm font-bold text-[#172922]">
                {accountName ? (
                  accountName.charAt(0).toUpperCase()
                ) : (
                  <UserRound size={17} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#A9BAAD]">
                  Your account
                </p>
                <p className="truncate text-sm font-semibold">
                  {authLoading
                    ? "Loading account..."
                    : accountName || "Planora user"}
                </p>
                <p className="truncate text-[10px] text-[#B9C8BE]">
                  {accountEmail || "Account details unavailable"}
                </p>
              </div>
            </div>

            {isEditingProfile ? (
              <form onSubmit={saveProfileName} className="space-y-2">
                <label
                  htmlFor="profile-name"
                  className="block text-xs text-[#D1DCD3]"
                >
                  Display name
                </label>
                <input
                  id="profile-name"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  value={profileNameDraft}
                  onChange={(event) => setProfileNameDraft(event.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-[#102019] px-3 py-2 text-sm text-white outline-none focus:border-[#D6F379]"
                />

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingProfile || authLoading}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#D6F379] px-2 py-2 text-xs font-semibold text-[#172922] disabled:opacity-50"
                  >
                    {savingProfile ? (
                      <LoaderCircle size={13} className="animate-spin" />
                    ) : (
                      <Save size={13} />
                    )}
                    Save
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileNameDraft(accountName);
                      setIsEditingProfile(false);
                    }}
                    className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setProfileNameDraft(accountName);
                  setIsEditingProfile(true);
                }}
                disabled={authLoading || !accountEmail}
                className="mb-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-[#E4ECE5] hover:bg-white/5 disabled:opacity-50"
              >
                <Pencil size={13} />
                Set or edit name
              </button>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              disabled={loggingOut || authLoading || !accountEmail}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500/20 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loggingOut ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <LogOut size={16} />
              )}
              {loggingOut ? "Signing out..." : "Sign out"}
            </button>
          </section>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#34473D] text-[#D6F379]">
              <Lightbulb size={19} />
            </div>
            <p className="text-sm font-semibold">A little planning magic</p>
            <p className="mt-2 text-xs leading-5 text-[#B9C8BE]">
              Great events begin with a clear plan. Start with your vision and
              build from there.
            </p>
            <button
              onClick={() => openCreateModal()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-[#172922] transition hover:bg-[#D6F379]"
            >
              <Plus size={16} />
              Create an event
            </button>
          </div>

          <p className="px-2 pb-1 pt-2 text-center text-[10px] text-[#91A69A]">
            PLANORA AI · YOUR MOMENTS, ORGANIZED
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#E8EBE5] bg-[#F7F8F6]/95 px-5 py-4 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#172922] text-[#D6F379] lg:hidden">
              <Sparkles size={19} />
            </div>
            <div>
              <p className="text-xs text-[#818A80]">Workspace / Overview</p>
              <p className="mt-0.5 text-sm font-semibold text-[#28372C]">
                Your event command center
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden rounded-full border border-[#E3E8DD] bg-white px-3 py-2 text-xs text-[#6A756B] sm:inline-flex sm:items-center sm:gap-2">
              <span className="h-2 w-2 rounded-full bg-[#87B76C]" />
              Planning workspace
            </span>

            <button
              aria-label="Notifications"
              title="Notifications"
              className="rounded-xl border border-[#E4E8E0] bg-white p-2.5 text-[#647064] transition hover:bg-[#EEF2E9]"
            >
              <Bell size={18} />
            </button>

            <a
              href="/ai-planner"
              className="inline-flex items-center gap-2 rounded-xl border border-[#DCE4D5] bg-white px-3 py-2.5 text-sm font-semibold text-[#26392B] transition hover:border-[#B6CC96] hover:bg-[#F0F5E8] sm:px-4"
            >
              <Sparkles size={17} className="text-[#718A56]" />
              <span className="hidden sm:inline">AI Planner</span>
              <span className="sm:hidden">AI</span>
            </a>

            <button
              onClick={() => openCreateModal()}
              className="flex items-center gap-2 rounded-xl bg-[#172922] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#294438] sm:px-4"
            >
              <Plus size={17} />
              <span className="hidden sm:inline">New event</span>
              <span className="sm:hidden">Create</span>
            </button>
          </div>
        </header>

        <div
          id="overview"
          className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10"
        >
          {notice && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#DCE8C4] bg-[#F0F8E4] px-4 py-3 text-sm text-[#35512B]">
              <CheckCircle2 size={19} />
              <span className="flex-1">{notice}</span>
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss message"
              >
                <X size={17} />
              </button>
            </div>
          )}

          {!eventsLoaded && (
            <p className="mb-5 text-xs text-[#778273]">
              Loading your cloud workspace...
            </p>
          )}

          <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E3E9D8] bg-white px-3 py-1.5 text-xs font-medium text-[#5B7552]">
                <Sparkles size={14} />
                YOUR PERSONAL EVENT PLANNER
              </div>

              <h2 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                Plan meaningful moments.
                <br />
                <span className="text-[#829849]">
                  Leave the chaos to us.
                </span>
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-[#737D73] sm:text-base">
                Bring your ideas to life with organized budgets, actionable
                checklists and a little inspiration.
              </p>

              {accountName && (
                <p className="mt-3 text-sm text-[#7B8779]">
                  Welcome,{" "}
                  <span className="font-semibold text-[#39523B]">
                    {accountName}
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/ai-planner"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#DCE4D5] bg-white px-4 py-3 text-sm font-semibold text-[#26392B] transition hover:bg-[#F0F5E8]"
              >
                <Sparkles size={17} />
                AI event planner
              </a>

              <button
                onClick={() => openCreateModal()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#D6F379] px-5 py-3 text-sm font-bold text-[#233020] transition hover:bg-[#C8E866]"
              >
                <Plus size={18} />
                Start planning
                <ArrowUpRight size={16} />
              </button>
            </div>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: "Events planned",
                value: String(events.length),
                subtitle: "Your celebrations",
                icon: CalendarDays,
                color: "bg-[#E9F1DF] text-[#66834D]",
              },
              {
                title: "Total planned budget",
                value: formatINR(totalBudget),
                subtitle: "Across all your events",
                icon: CircleDollarSign,
                color: "bg-[#E3EFEA] text-[#3E8069]",
              },
              {
                title: "Tasks remaining",
                value: String(pendingTasks),
                subtitle: `${completedTasks} completed so far`,
                icon: ClipboardCheck,
                color: "bg-[#F7EBDD] text-[#B77B44]",
              },
              {
                title: "Next celebration",
                value: nextEvent
                  ? formatDate(nextEvent.date)
                  : "Not scheduled",
                subtitle: nextEvent
                  ? nextEvent.name
                  : "Create your first event",
                icon: Clock3,
                color: "bg-[#EEE8F7] text-[#8567AB]",
              },
            ].map((stat) => {
              const Icon = stat.icon;

              return (
                <div
                  key={stat.title}
                  className="rounded-2xl border border-[#E8EBE5] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span className="text-sm text-[#697468]">
                      {stat.title}
                    </span>
                    <div className={`rounded-xl p-2.5 ${stat.color}`}>
                      <Icon size={19} />
                    </div>
                  </div>

                  <p className="break-words text-2xl font-semibold tracking-tight text-[#26352A]">
                    {stat.value}
                  </p>

                  <p className="mt-2 truncate text-xs text-[#849084]">
                    {stat.subtitle}
                  </p>
                </div>
              );
            })}
          </section>

          <section className="mt-9">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">
                  What are we celebrating?
                </h3>
                <p className="mt-1 text-sm text-[#80897F]">
                  Choose your event to get your planning started.
                </p>
              </div>
              <span className="hidden text-xs text-[#8A9388] sm:inline">
                3 event categories
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {eventTypes.map((eventType) => {
                const Icon = eventType.icon;

                return (
                  <button
                    key={eventType.name}
                    onClick={() => openCreateModal(eventType.name)}
                    disabled={!eventsLoaded}
                    className="group flex items-start gap-4 rounded-2xl border border-[#E7EAE3] bg-white p-5 text-left transition hover:border-[#C6D9A4] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F0F4E8] text-[#5F7749] transition group-hover:bg-[#D6F379]">
                      <Icon size={23} />
                    </div>

                    <div className="flex-1">
                      <h4 className="font-semibold">{eventType.name}</h4>
                      <p className="mt-1 text-sm leading-5 text-[#818A80]">
                        {eventType.description}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#627C4A]">
                        Start planning <ChevronRight size={15} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section id="events" className="mt-10 scroll-mt-24">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">
                  My events
                </h3>
                <p className="mt-1 text-sm text-[#80897F]">
                  Every celebration, all in one place.
                </p>
              </div>

              <span className="rounded-full bg-[#EAEFE5] px-3 py-1 text-xs font-medium text-[#62725E]">
                {events.length} total
              </span>
            </div>

            {events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#D5DDD0] bg-white px-6 py-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0F4E8] text-[#718A56]">
                  <CalendarDays size={25} />
                </div>

                <h4 className="mt-4 font-semibold">
                  Your first event starts here
                </h4>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#818A80]">
                  Create an event to organize its budget, set up your checklist
                  and keep everything in one place.
                </p>

                <button
                  onClick={() => openCreateModal()}
                  disabled={!eventsLoaded}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#172922] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#294438] disabled:opacity-60"
                >
                  <Plus size={16} />
                  Create your first event
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {events.map((event) => {
                  const done = event.tasks.filter((task) => task.done).length;
                  const progress = event.tasks.length
                    ? Math.round((done / event.tasks.length) * 100)
                    : 0;

                  const savedPlan = linkedPlans[event.id];

                  const Icon =
                    event.type === "Wedding"
                      ? Heart
                      : event.type === "Birthday"
                        ? Cake
                        : PartyPopper;

                  const plannerUrl = savedPlan
                    ? `/ai-planner?planId=${encodeURIComponent(savedPlan.id)}`
                    : `/ai-planner?eventId=${encodeURIComponent(event.id)}`;

                  return (
                    <article
                      key={event.id}
                      className="rounded-2xl border border-[#E6EAE2] bg-white p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-[#F0F4E8] p-3 text-[#68824F]">
                            <Icon size={21} />
                          </div>
                          <div>
                            <h4 className="font-semibold">{event.name}</h4>
                            <p className="mt-1 text-xs text-[#828B80]">
                              {event.type}
                            </p>
                          </div>
                        </div>

                        <span className="rounded-full bg-[#EDF4E5] px-2.5 py-1 text-xs font-medium text-[#587345]">
                          {progress}% done
                        </span>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-[#879084]">Event date</p>
                          <p className="mt-1 text-sm font-medium">
                            {formatDate(event.date)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-[#879084]">Budget</p>
                          <p className="mt-1 text-sm font-medium">
                            {formatINR(event.budget)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-[#879084]">Guests</p>
                          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                            <Users size={15} />
                            {event.guests}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-[#879084]">Location</p>
                          <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium">
                            <MapPin size={14} />
                            {event.location}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#EEF1EA]">
                        <div
                          className="h-full rounded-full bg-[#92AF69] transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <p className="mt-2 text-xs text-[#7F897B]">
                        {done} of {event.tasks.length} tasks completed
                      </p>

                      <div className="mt-4 border-t border-[#EDF0E9] pt-4">
                        <a
                          href={plannerUrl}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#DCE4D5] bg-[#F8FAF5] px-4 py-3 text-sm font-semibold text-[#385138] transition hover:border-[#B6CC96] hover:bg-[#EFF5E8]"
                        >
                          {savedPlan ? (
                            <>
                              <BookOpen size={16} />
                              Open AI plan
                              <ExternalLink size={14} />
                            </>
                          ) : (
                            <>
                              <Sparkles size={16} />
                              Generate AI plan
                              <ArrowUpRight size={14} />
                            </>
                          )}
                        </a>

                        {savedPlan && (
                          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-[#6E8164]">
                            <Link2 size={13} />
                            Linked plan: {savedPlan.eventName}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section id="budget" className="mt-10 scroll-mt-24">
            <div className="mb-4">
              <h3 className="text-lg font-semibold tracking-tight">
                Budget planner
              </h3>
              <p className="mt-1 text-sm text-[#80897F]">
                Suggested budget allocation for your first event.
              </p>
            </div>

            {events.length === 0 ? (
              <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#E6EAE2] bg-white p-6 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl bg-[#E7F1E9] p-3 text-[#45836D]">
                    <Wallet size={23} />
                  </div>
                  <div>
                    <h4 className="font-semibold">
                      Your budget starts with your event
                    </h4>
                    <p className="mt-1 text-sm text-[#818A80]">
                      Create an event to see its estimated spending breakdown.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => openCreateModal()}
                  disabled={!eventsLoaded}
                  className="rounded-xl border border-[#DCE2D7] px-4 py-2.5 text-sm font-semibold hover:bg-[#F5F7F2] disabled:opacity-60"
                >
                  Set a budget
                </button>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="rounded-2xl bg-[#172922] p-6 text-white">
                  <div className="flex items-center gap-2 text-sm text-[#B9C8BE]">
                    <CircleDollarSign size={17} />
                    Total planned budget
                  </div>

                  <p className="mt-4 text-3xl font-semibold tracking-tight">
                    {formatINR(totalBudget)}
                  </p>

                  <p className="mt-2 text-sm text-[#B9C8BE]">
                    Across {events.length}{" "}
                    {events.length === 1 ? "event" : "events"}
                  </p>

                  <div className="mt-7 border-t border-white/10 pt-4">
                    <p className="text-xs leading-5 text-[#B9C8BE]">
                      These allocations are starting estimates, not actual
                      vendor quotes. Customize them as you collect real prices.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E6EAE2] bg-white p-6">
                  <h4 className="font-semibold">Suggested allocation</h4>
                  <p className="mt-1 text-xs text-[#879084]">
                    Based on the first event&apos;s budget
                  </p>

                  <div className="mt-5 space-y-4">
                    {budgetCategories.map((category) => {
                      const amount =
                        (events[0].budget * category.percentage) / 100;

                      return (
                        <div key={category.name}>
                          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                            <span className="text-[#576256]">
                              {category.name}
                            </span>
                            <span className="font-medium">
                              {formatINR(amount)}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#EDF0EA]">
                            <div
                              className="h-full rounded-full bg-[#A8BF83]"
                              style={{ width: `${category.percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section id="timeline" className="mt-10 scroll-mt-24">
            <div className="mb-4">
              <h3 className="text-lg font-semibold tracking-tight">
                Planning timeline
              </h3>
              <p className="mt-1 text-sm text-[#80897F]">
                A simple sequence to help keep preparations on track.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E6EAE2] bg-white p-5 sm:p-6">
              {[
                {
                  number: "01",
                  title: "Define the vision",
                  detail: "Pick your event style, date and budget.",
                  icon: Compass,
                },
                {
                  number: "02",
                  title: "Book the essentials",
                  detail: "Shortlist venues and key vendors.",
                  icon: CalendarDays,
                },
                {
                  number: "03",
                  title: "Coordinate the details",
                  detail: "Manage guests, food, decoration and activities.",
                  icon: ClipboardCheck,
                },
                {
                  number: "04",
                  title: "Final checks",
                  detail: "Confirm bookings and prepare for event day.",
                  icon: CheckCircle2,
                },
              ].map((step, index) => {
                const Icon = step.icon;

                return (
                  <div
                    key={step.number}
                    className={`flex gap-4 py-4 ${
                      index < 3 ? "border-b border-[#EEF0EA]" : ""
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F4E8] text-[#67814F]">
                      <Icon size={19} />
                    </div>

                    <div className="flex-1">
                      <p className="text-sm font-semibold">
                        {step.number}. {step.title}
                      </p>
                      <p className="mt-1 text-sm leading-5 text-[#818A80]">
                        {step.detail}
                      </p>
                    </div>

                    <ChevronRight
                      size={18}
                      className="mt-1 shrink-0 text-[#B1BAAC]"
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <section id="tasks" className="mt-10 scroll-mt-24">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">
                  Vendors & task checklist
                </h3>
                <p className="mt-1 text-sm text-[#80897F]">
                  Tick off each task as your preparation progresses.
                </p>
              </div>

              {allTasks.length > 0 && (
                <span className="text-xs text-[#7B8779]">
                  {completedTasks}/{allTasks.length} complete
                </span>
              )}
            </div>

            {events.length === 0 ? (
              <div className="rounded-2xl border border-[#E6EAE2] bg-white p-7 text-center">
                <ClipboardCheck
                  className="mx-auto text-[#82966B]"
                  size={28}
                />
                <p className="mt-3 font-semibold">
                  Your checklist is ready to be created
                </p>
                <p className="mt-1 text-sm text-[#818A80]">
                  Create an event to get a starting checklist tailored to its
                  type.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-[#E6EAE2] bg-white p-5"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-semibold">{event.name}</h4>
                        <p className="mt-1 text-xs text-[#818A80]">
                          {event.type}
                        </p>
                      </div>
                      <span className="text-xs text-[#71856A]">
                        {event.tasks.filter((task) => task.done).length} of{" "}
                        {event.tasks.length}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {event.tasks.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => toggleTask(event.id, task.id)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-[#F7F8F4]"
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              task.done
                                ? "border-[#78985D] bg-[#78985D] text-white"
                                : "border-[#CCD4C6] bg-white"
                            }`}
                          >
                            {task.done && <Check size={14} />}
                          </span>

                          <span
                            className={`flex-1 text-sm ${
                              task.done
                                ? "text-[#969F94] line-through"
                                : "text-[#455144]"
                            }`}
                          >
                            {task.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section id="ideas" className="mt-10 scroll-mt-24">
            <div className="mb-4">
              <h3 className="text-lg font-semibold tracking-tight">
                Ideas & inspiration
              </h3>
              <p className="mt-1 text-sm text-[#80897F]">
                Explore planning principles or generate customized ideas with AI.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: Sparkles,
                  title: "Find your theme",
                  detail:
                    "Choose a theme that reflects the occasion and the people attending.",
                },
                {
                  icon: Wallet,
                  title: "Spend with intention",
                  detail:
                    "Prioritize what matters most and leave room for unexpected costs.",
                },
                {
                  icon: Users,
                  title: "Design for your guests",
                  detail:
                    "Consider accessibility, food preferences and how guests will participate.",
                },
              ].map((idea) => {
                const Icon = idea.icon;

                return (
                  <div
                    key={idea.title}
                    className="rounded-2xl border border-[#E6EAE2] bg-white p-5"
                  >
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0F4E8] text-[#69814F]">
                      <Icon size={20} />
                    </div>
                    <h4 className="font-semibold">{idea.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-[#818A80]">
                      {idea.detail}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-[#DDE7D3] bg-[#EFF5E8] p-5 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#6D8C4C]">
                <Sparkles size={23} />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">
                  Your personal AI event assistant
                </h4>
                <p className="mt-1 text-sm leading-6 text-[#697965]">
                  Generate customized event plans, budget suggestions,
                  preparation timelines and creative ideas with Gemini.
                </p>
              </div>
              <a
                href="/ai-planner"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#172922] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#294438]"
              >
                <Sparkles size={16} />
                Open AI Planner
              </a>
            </div>
          </section>

          <footer className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-[#E6EAE2] py-6 text-xs text-[#929B90] sm:flex-row">
            <p>Planora AI · Thoughtful planning, beautiful moments.</p>
            <p>Cloud workspace with local browser caching.</p>
          </footer>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#101B14]/55 p-4 backdrop-blur-sm">
          <div className="my-auto w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EDF4E4] text-[#6A844F]">
                  <PartyPopper size={23} />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Let&apos;s plan something special.
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#7D877B]">
                  Tell us a few details to set up your event workspace.
                </p>
              </div>

              <button
                onClick={() => setModalOpen(false)}
                aria-label="Close dialog"
                className="rounded-xl border border-[#E6EAE2] p-2 text-[#6B7669] hover:bg-[#F5F7F2]"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={createEvent} className="space-y-5">
              <div>
                <label
                  htmlFor="event-name"
                  className="mb-2 block text-sm font-medium"
                >
                  Event name
                </label>
                <input
                  id="event-name"
                  required
                  maxLength={80}
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="e.g. Our big day, Mom's 50th birthday"
                  className="w-full rounded-xl border border-[#DDE3D8] px-4 py-3 text-sm outline-none transition focus:border-[#8DAA68] focus:ring-2 focus:ring-[#D6F379]/40"
                />
              </div>

              <div>
                <label
                  htmlFor="event-type"
                  className="mb-2 block text-sm font-medium"
                >
                  Event type
                </label>
                <select
                  id="event-type"
                  value={form.type}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      type: event.target.value as EventType,
                    })
                  }
                  className="w-full rounded-xl border border-[#DDE3D8] bg-white px-4 py-3 text-sm outline-none focus:border-[#8DAA68] focus:ring-2 focus:ring-[#D6F379]/40"
                >
                  {eventTypes.map((eventType) => (
                    <option key={eventType.name} value={eventType.name}>
                      {eventType.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="event-date"
                    className="mb-2 block text-sm font-medium"
                  >
                    Event date
                  </label>
                  <input
                    id="event-date"
                    type="date"
                    required
                    min={today}
                    value={form.date}
                    onChange={(event) =>
                      setForm({ ...form, date: event.target.value })
                    }
                    className="w-full rounded-xl border border-[#DDE3D8] px-3 py-3 text-sm outline-none focus:border-[#8DAA68] focus:ring-2 focus:ring-[#D6F379]/40"
                  />
                </div>

                <div>
                  <label
                    htmlFor="event-guests"
                    className="mb-2 block text-sm font-medium"
                  >
                    Expected guests
                  </label>
                  <input
                    id="event-guests"
                    type="number"
                    required
                    min="1"
                    max="1000000"
                    value={form.guests}
                    onChange={(event) =>
                      setForm({ ...form, guests: event.target.value })
                    }
                    className="w-full rounded-xl border border-[#DDE3D8] px-4 py-3 text-sm outline-none focus:border-[#8DAA68] focus:ring-2 focus:ring-[#D6F379]/40"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="event-location"
                  className="mb-2 block text-sm font-medium"
                >
                  Location
                </label>
                <input
                  id="event-location"
                  required
                  maxLength={120}
                  value={form.location}
                  onChange={(event) =>
                    setForm({ ...form, location: event.target.value })
                  }
                  placeholder="City, venue or neighborhood"
                  className="w-full rounded-xl border border-[#DDE3D8] px-4 py-3 text-sm outline-none focus:border-[#8DAA68] focus:ring-2 focus:ring-[#D6F379]/40"
                />
              </div>

              <div>
                <label
                  htmlFor="event-budget"
                  className="mb-2 block text-sm font-medium"
                >
                  Total budget (INR)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#788474]">
                    ₹
                  </span>
                  <input
                    id="event-budget"
                    type="number"
                    required
                    min="1"
                    max="1000000000"
                    value={form.budget}
                    onChange={(event) =>
                      setForm({ ...form, budget: event.target.value })
                    }
                    className="w-full rounded-xl border border-[#DDE3D8] py-3 pl-9 pr-4 text-sm outline-none focus:border-[#8DAA68] focus:ring-2 focus:ring-[#D6F379]/40"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-[#EDF0E9] pt-5 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-xl border border-[#DDE3D8] px-4 py-3 text-sm font-semibold hover:bg-[#F7F8F4]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={!eventsLoaded}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#172922] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#294438] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles size={16} />
                  Create event workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
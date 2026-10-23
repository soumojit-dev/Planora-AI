
"use client";

import { useEffect, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  History,
  Lightbulb,
  Link2,
  LoaderCircle,
  MapPin,
  Send,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import {
  loadAndSyncPlanoraData,
  savePlanToCloud,
  type EventType,
  type PlanoraEvent,
  type PlanoraSavedPlan,
} from "@/lib/planora-cloud";

type PlannerForm = {
  eventName: string;
  eventType: EventType;
  date: string;
  location: string;
  guests: string;
  budget: string;
  priorities: string;
};

type ApiResponse = {
  plan?: string;
  error?: string;
};

const EVENT_STORAGE_KEY = "planora-events-v1";
const PLAN_STORAGE_KEY = "planora-ai-plans-v1";

const initialForm: PlannerForm = {
  eventName: "",
  eventType: "Wedding",
  date: "",
  location: "",
  guests: "100",
  budget: "100000",
  priorities: "",
};

function isEventType(value: unknown): value is EventType {
  return (
    value === "Wedding" ||
    value === "Birthday" ||
    value === "Community Event"
  );
}

function isDashboardEvent(value: unknown): value is PlanoraEvent {
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

function isSavedPlan(value: unknown): value is PlanoraSavedPlan {
  if (typeof value !== "object" || value === null) return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    (typeof item.eventId === "string" || item.eventId === null) &&
    typeof item.eventName === "string" &&
    isEventType(item.eventType) &&
    typeof item.date === "string" &&
    typeof item.location === "string" &&
    typeof item.guests === "number" &&
    Number.isFinite(item.guests) &&
    typeof item.budget === "number" &&
    Number.isFinite(item.budget) &&
    typeof item.priorities === "string" &&
    typeof item.plan === "string" &&
    typeof item.savedAt === "string"
  );
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

function formFromSavedPlan(saved: PlanoraSavedPlan): PlannerForm {
  return {
    eventName: saved.eventName,
    eventType: saved.eventType,
    date: saved.date,
    location: saved.location,
    guests: String(saved.guests),
    budget: String(saved.budget),
    priorities: saved.priorities,
  };
}

function formFromDashboardEvent(event: PlanoraEvent): PlannerForm {
  return {
    eventName: event.name,
    eventType: event.type,
    date: event.date,
    location: event.location,
    guests: String(event.guests),
    budget: String(event.budget),
    priorities: "",
  };
}

export default function AIPlannerPage() {
  const [form, setForm] = useState<PlannerForm>(initialForm);
  const [dashboardEvents, setDashboardEvents] = useState<PlanoraEvent[]>([]);
  const [savedPlans, setSavedPlans] = useState<PlanoraSavedPlan[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [plan, setPlan] = useState("");
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [activePlanId, setActivePlanId] = useState("");

  useEffect(() => {
    let active = true;

    const params = new URLSearchParams(window.location.search);
    const requestedPlanId = params.get("planId");
    const requestedEventId = params.get("eventId");

    async function restorePlanner() {
      let loadedEvents: PlanoraEvent[] = [];
      let loadedPlans: PlanoraSavedPlan[] = [];

      try {
        const synced = await loadAndSyncPlanoraData();

        loadedEvents = synced.events;
        loadedPlans = synced.plans;
      } catch (cause) {
        console.error("Planora could not synchronize planner data.", cause);

        if (active) {
          setError(
            "Cloud synchronization failed. Showing available local data; changes may not sync until the connection is restored."
          );
        }

        try {
          const eventsRaw = window.localStorage.getItem(EVENT_STORAGE_KEY);
          const plansRaw = window.localStorage.getItem(PLAN_STORAGE_KEY);

          if (eventsRaw) {
            const parsed: unknown = JSON.parse(eventsRaw);
            if (Array.isArray(parsed)) {
              loadedEvents = parsed.filter(isDashboardEvent);
            }
          }

          if (plansRaw) {
            const parsed: unknown = JSON.parse(plansRaw);
            if (Array.isArray(parsed)) {
              loadedPlans = parsed.filter(isSavedPlan);
            }
          }
        } catch (localError) {
          console.error(
            "Planora could not read local planning data.",
            localError
          );
        }
      }

      if (!active) return;

      setDashboardEvents(loadedEvents);
      setSavedPlans(loadedPlans);

      if (requestedPlanId) {
        const requestedPlan = loadedPlans.find(
          (item) => item.id === requestedPlanId
        );

        if (requestedPlan) {
          setSelectedEventId(requestedPlan.eventId ?? "");
          setForm(formFromSavedPlan(requestedPlan));
          setPlan(requestedPlan.plan);
          setActivePlanId(requestedPlan.id);
          setSaveNotice(`Opened saved AI plan: ${requestedPlan.eventName}.`);
        } else {
          setError(
            "This saved AI plan could not be found in your available cloud or browser data."
          );
        }
      } else if (requestedEventId) {
        const requestedEvent = loadedEvents.find(
          (item) => item.id === requestedEventId
        );

        if (requestedEvent) {
          setSelectedEventId(requestedEvent.id);
          setForm(formFromDashboardEvent(requestedEvent));
          setSaveNotice(
            `Ready to generate an AI plan for "${requestedEvent.name}".`
          );
        } else {
          setError(
            "That dashboard event could not be found. Select an event or enter the details manually."
          );
        }
      }
    }

    void restorePlanner();

    return () => {
      active = false;
    };
  }, []);

  function updateField<K extends keyof PlannerForm>(
    field: K,
    value: PlannerForm[K]
  ) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function selectDashboardEvent(eventId: string) {
    setSelectedEventId(eventId);
    setPlan("");
    setActivePlanId("");
    setSaveNotice("");
    setError("");

    if (!eventId) return;

    const event = dashboardEvents.find((item) => item.id === eventId);

    if (!event) return;

    setForm(formFromDashboardEvent(event));
  }

  function openSavedPlan(saved: PlanoraSavedPlan) {
    setSelectedEventId(saved.eventId ?? "");
    setForm(formFromSavedPlan(saved));
    setPlan(saved.plan);
    setActivePlanId(saved.id);
    setError("");
    setSaveNotice(`Opened saved plan: ${saved.eventName}.`);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function generatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setPlan("");
    setSaveNotice("");
    setActivePlanId("");
    setLoading(true);

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          guests: Number(form.guests),
          budget: Number(form.budget),
        }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to generate your plan. Please try again."
        );
      }

      if (!data.plan) {
        throw new Error("The AI returned an empty plan. Please try again.");
      }

      const newSavedPlan: PlanoraSavedPlan = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        eventId: selectedEventId || null,
        eventName: form.eventName.trim(),
        eventType: form.eventType,
        date: form.date,
        location: form.location.trim(),
        guests: Number(form.guests),
        budget: Number(form.budget),
        priorities: form.priorities,
        plan: data.plan,
        savedAt: new Date().toISOString(),
      };

      const nextPlans = [
        newSavedPlan,
        ...savedPlans.filter((item) => item.id !== newSavedPlan.id),
      ].slice(0, 50);

      setPlan(data.plan);
      setSavedPlans(nextPlans);
      setActivePlanId(newSavedPlan.id);

      let localSaveSucceeded = false;

      try {
        window.localStorage.setItem(
          PLAN_STORAGE_KEY,
          JSON.stringify(nextPlans)
        );
        localSaveSucceeded = true;
      } catch (storageError) {
        console.error(
          "Planora could not cache the generated AI plan.",
          storageError
        );
      }

      setSaveNotice(
        localSaveSucceeded
          ? "Your AI plan was generated and cached locally. Saving to the cloud..."
          : "Your AI plan was generated. Saving it to the cloud..."
      );

      try {
        await savePlanToCloud(newSavedPlan);

        setSaveNotice(
          selectedEventId
            ? `Your AI plan has been saved and linked to "${form.eventName}" in the cloud.`
            : "Your AI plan has been saved to the cloud as a standalone plan."
        );
      } catch (cloudError) {
        console.error(
          "Planora could not save the AI plan to Supabase.",
          cloudError
        );

        setSaveNotice(
          `The plan was generated${
            localSaveSucceeded ? " and cached locally" : ""
          }, but cloud synchronization failed: ${
            cloudError instanceof Error
              ? cloudError.message
              : "Please try again."
          }`
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F8F6] text-[#202820]">
      <header className="border-b border-[#E5EAE1] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#526250] transition hover:text-[#172922]"
          >
            <ArrowLeft size={17} />
            Back to dashboard
          </a>

          <div className="flex items-center gap-2 rounded-full border border-[#E3E9D8] bg-[#F4F8ED] px-3 py-2">
            <Sparkles size={16} className="text-[#6A854D]" />
            <span className="text-sm font-semibold">Planora AI</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-9 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#E1E8D8] bg-white px-3 py-1.5 text-xs font-medium text-[#65814E]">
            <Sparkles size={14} />
            YOUR PERSONAL AI EVENT ASSISTANT
          </div>

          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Your vision.
            <br />
            <span className="text-[#829849]">
              A plan that brings it to life.
            </span>
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#737D73] sm:text-base">
            Plan weddings, birthdays and community events with AI-generated
            budgets, timelines, vendor checklists and personalized ideas.
          </p>
        </div>

        <div className="grid items-start gap-7 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-3xl border border-[#E5EAE1] bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Tell us about your event
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#7E887B]">
                Link your plan to an existing event or create a standalone plan.
              </p>
            </div>

            <form onSubmit={generatePlan} className="space-y-5">
              <div>
                <label
                  htmlFor="dashboardEvent"
                  className="mb-2 block text-sm font-medium"
                >
                  Link to a dashboard event
                </label>

                <select
                  id="dashboardEvent"
                  value={selectedEventId}
                  onChange={(event) => selectDashboardEvent(event.target.value)}
                  className="w-full rounded-xl border border-[#DDE3D8] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#8DAA68] focus:ring-2 focus:ring-[#D6F379]/40"
                >
                  <option value="">Standalone plan (not linked)</option>

                  {dashboardEvents.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {item.type}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs leading-5 text-[#879084]">
                  {dashboardEvents.length
                    ? "Select an event to automatically fill its saved details."
                    : "No dashboard events were found. You can still create a standalone plan."}
                </p>
              </div>

              <div>
                <label
                  htmlFor="eventName"
                  className="mb-2 block text-sm font-medium"
                >
                  Event name
                </label>
                <input
                  id="eventName"
                  required
                  maxLength={100}
                  value={form.eventName}
                  onChange={(event) => updateField("eventName", event.target.value)}
                  placeholder="e.g. Our wedding celebration"
                  className="w-full rounded-xl border border-[#DDE3D8] px-4 py-3 text-sm outline-none transition focus:border-[#8DAA68] focus:ring-2 focus:ring-[#D6F379]/40"
                />
              </div>

              <div>
                <label
                  htmlFor="eventType"
                  className="mb-2 block text-sm font-medium"
                >
                  Type of event
                </label>
                <select
                  id="eventType"
                  value={form.eventType}
                  onChange={(event) => updateField("eventType", event.target.value as EventType)}
                  className="w-full rounded-xl border border-[#DDE3D8] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#8DAA68] focus:ring-2 focus:ring-[#D6F379]/40"
                >
                  <option value="Wedding">Wedding</option>
                  <option value="Birthday">Birthday</option>
                  <option value="Community Event">Community event</option>
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="date"
                    className="mb-2 block text-sm font-medium"
                  >
                    Event date
                  </label>
                  <div className="relative">
                    <CalendarDays
                      size={17}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#82907D]"
                    />
                    <input
                      id="date"
                      type="date"
                      required
                      value={form.date}
                      onChange={(event) => updateField("date", event.target.value)}
                      className="w-full min-w-0 rounded-xl border border-[#DDE3D8] py-3 pl-9 pr-2 text-sm outline-none transition focus:border-[#8DAA68] focus:ring-2 focus:ring-[#D6F379]/40"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="guests"
                    className="mb-2 block text-sm font-medium"
                  >
                    Number of guests
                  </label>
                  <div className="relative">
                    <Users
                      size={17}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#82907D]"
                    />
                    <input
                      id="guests"
                      type="number"
                      required
                      min="1"
                      max="1000000"
                      value={form.guests}
                      onChange={(event) => updateField("guests", event.target.value)}
                      className="w-full rounded-xl border border-[#DDE3D8] py-3 pl-9 pr-3 text-sm outline-none transition focus:border-[#8DAA68] focus:ring-2 focus:ring-[#D6F379]/40"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="location"
                  className="mb-2 block text-sm font-medium"
                >
                  Location
                </label>
                <div className="relative">
                  <MapPin
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#82907D]"
                  />
                  <input
                    id="location"
                    required
                    maxLength={120}
                    value={form.location}
                    onChange={(event) => updateField("location", event.target.value)}
                    placeholder="e.g. Kolkata, West Bengal"
                    className="w-full rounded-xl border border-[#DDE3D8] py-3 pl-9 pr-4 text-sm outline-none transition focus:border-[#8DAA68] focus:ring-2 focus:ring-[#D6F379]/40"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="budget"
                  className="mb-2 block text-sm font-medium"
                >
                  Total budget (INR)
                </label>
                <div className="relative">
                  <Wallet
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#82907D]"
                  />
                  <input
                    id="budget"
                    type="number"
                    required
                    min="1"
                    max="1000000000"
                    value={form.budget}
                    onChange={(event) => updateField("budget", event.target.value)}
                    className="w-full rounded-xl border border-[#DDE3D8] py-3 pl-9 pr-4 text-sm outline-none transition focus:border-[#8DAA68] focus:ring-2 focus:ring-[#D6F379]/40"
                  />
                </div>
                <p className="mt-2 text-xs text-[#879084]">
                  Enter 100000 for a budget of ₹1,00,000.
                </p>
              </div>

              <div>
                <label
                  htmlFor="priorities"
                  className="mb-2 block text-sm font-medium"
                >
                  Preferences and ideas
                  <span className="ml-2 font-normal text-[#899286]">
                    Optional
                  </span>
                </label>
                <textarea
                  id="priorities"
                  maxLength={1000}
                  rows={4}
                  value={form.priorities}
                  onChange={(event) => updateField("priorities", event.target.value)}
                  placeholder="e.g. Traditional Bengali theme, vegetarian food, outdoor venue and simple decorations..."
                  className="w-full resize-y rounded-xl border border-[#DDE3D8] px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#8DAA68] focus:ring-2 focus:ring-[#D6F379]/40"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
                >
                  {error}
                </div>
              )}

              {saveNotice && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-[#DCE8C4] bg-[#F0F8E4] p-3 text-sm leading-6 text-[#35512B]"
                >
                  <CheckCircle2 size={18} className="mt-1 shrink-0" />
                  <span>{saveNotice}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#172922] px-5 py-4 text-sm font-semibold text-white transition hover:bg-[#294438] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    Creating your event plan...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Generate my AI event plan
                    <Send size={16} />
                  </>
                )}
              </button>

              <p className="text-center text-xs leading-5 text-[#8A9387]">
                Plans are saved in this browser and synced to the cloud.
                AI budgets and prices are estimates, not verified quotes.
              </p>
            </form>
          </section>

          <section className="min-w-0">
            {!plan && !loading && (
              <div className="flex min-h-[440px] flex-col items-center justify-center rounded-3xl border border-dashed border-[#D5DDD0] bg-white px-6 py-12 text-center sm:px-10">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF4E5] text-[#718A56]">
                  <Sparkles size={30} />
                </div>

                <h2 className="mt-5 text-xl font-semibold">
                  Your personalized plan starts here
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-7 text-[#7D877B]">
                  Generate a plan to see your budget breakdown, timeline,
                  vendor checklist and personalized ideas.
                </p>

                <div className="mt-8 grid w-full max-w-md grid-cols-2 gap-3 text-left">
                  {[
                    { icon: Wallet, label: "Budget breakdown" },
                    { icon: Clock3, label: "Planning timeline" },
                    { icon: CheckCircle2, label: "Vendor checklist" },
                    { icon: Lightbulb, label: "Creative ideas" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className="flex items-center gap-2 rounded-xl bg-[#F6F8F3] p-3 text-xs font-medium text-[#61705C]"
                      >
                        <Icon size={16} />
                        {item.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {loading && (
              <div
                role="status"
                className="flex min-h-[440px] flex-col items-center justify-center rounded-3xl border border-[#E5EAE1] bg-white px-6 text-center"
              >
                <LoaderCircle size={42} className="animate-spin text-[#718A56]" />
                <h2 className="mt-5 text-xl font-semibold">
                  Planning something special...
                </h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[#7D877B]">
                  Gemini is preparing your ideas, budget, timeline and
                  checklist. This can take a little time.
                </p>
              </div>
            )}

            {plan && !loading && (
              <div
                id="ai-plan-print-area"
                className="overflow-hidden rounded-3xl border border-[#E5EAE1] bg-white shadow-sm"
              >
                <div className="flex items-start gap-3 bg-[#172922] p-5 text-white sm:p-6">
                  <div className="rounded-xl bg-[#D6F379] p-2.5 text-[#172922]">
                    <Sparkles size={22} />
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-[#C4D1C7]">
                      Generated with Gemini
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">
                      Your personalized event plan
                    </h2>
                    <p className="mt-2 text-sm text-[#CBD6CE]">
                      {form.eventName} · {form.location}
                    </p>
                    <p className="mt-1 text-xs text-[#CBD6CE]">
                      {formatDate(form.date)} · {formatINR(Number(form.budget))}
                    </p>
                  </div>
                </div>

                <div className="max-h-[850px] overflow-y-auto p-5 sm:p-7">
                  <article
                    className={[
                      "break-words text-sm leading-7 text-[#455144]",
                      "[&_h1]:mb-4 [&_h1]:mt-7 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:text-[#24352A]",
                      "[&_h2]:mb-3 [&_h2]:mt-7 [&_h2]:border-b [&_h2]:border-[#E7EBE3] [&_h2]:pb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#304532]",
                      "[&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-[#435B3B]",
                      "[&_p]:my-3",
                      "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6",
                      "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6",
                      "[&_li]:pl-1 [&_li::marker]:text-[#829849]",
                      "[&_strong]:font-semibold [&_strong]:text-[#283A2C]",
                      "[&_hr]:my-6 [&_hr]:border-[#E7EBE3]",
                      "[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-[#B0C68E] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[#687765]",
                      "[&_a]:font-medium [&_a]:text-[#587B3E] [&_a]:underline",
                      "[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-xs",
                      "[&_th]:border [&_th]:border-[#DDE4D8] [&_th]:bg-[#F0F4E9] [&_th]:p-2 [&_th]:font-semibold",
                      "[&_td]:border [&_td]:border-[#DDE4D8] [&_td]:p-2 [&_td]:align-top",
                      "[&_code]:rounded [&_code]:bg-[#F0F3EC] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
                    ].join(" ")}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {plan}
                    </ReactMarkdown>
                  </article>
                </div>

                <div className="print-hide border-t border-[#E8EBE5] bg-[#FAFBF8] p-4 sm:p-5">
                  <button
                    onClick={() => {
                      setPlan("");
                      setActivePlanId("");
                      setError("");
                      setSaveNotice("");
                    }}
                    className="w-full rounded-xl border border-[#DDE3D8] bg-white px-4 py-3 text-sm font-semibold transition hover:bg-[#F1F4EC]"
                  >
                    Create another plan
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        <section
          id="saved-plans"
          className="mt-10 rounded-3xl border border-[#E5EAE1] bg-white p-5 sm:p-7"
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <History size={20} className="text-[#69814F]" />
                <h2 className="text-xl font-semibold">Saved AI plans</h2>
              </div>
              <p className="mt-2 text-sm text-[#7D877B]">
                Reopen generated plans after refreshing this page.
              </p>
            </div>

            <span className="rounded-full bg-[#EFF4E9] px-3 py-1.5 text-xs font-semibold text-[#587345]">
              {savedPlans.length} / 50
            </span>
          </div>

          {savedPlans.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D5DDD0] px-5 py-10 text-center">
              <BookOpen size={27} className="mx-auto text-[#839675]" />
              <p className="mt-3 font-semibold">No saved AI plans yet</p>
              <p className="mt-1 text-sm text-[#7D877B]">
                Generate your first plan and it will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {savedPlans.map((saved) => {
                const linkedEvent = saved.eventId
                  ? dashboardEvents.find((item) => item.id === saved.eventId)
                  : undefined;

                return (
                  <article
                    key={saved.id}
                    className={`rounded-2xl border p-4 transition ${
                      activePlanId === saved.id
                        ? "border-[#A8C58A] bg-[#F5F8EF]"
                        : "border-[#E5EAE1] bg-white hover:border-[#C6D9A4]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-[#EEF4E5] p-3 text-[#718A56]">
                        <Sparkles size={20} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="break-words font-semibold">
                          {saved.eventName}
                        </h3>
                        <p className="mt-1 text-xs text-[#7D877B]">
                          {saved.eventType} · {formatDate(saved.date)}
                        </p>
                        <p className="mt-1 text-xs text-[#7D877B]">
                          {formatINR(saved.budget)} · {saved.guests} guests
                        </p>

                        <div className="mt-3 flex items-center gap-1.5 text-xs">
                          {linkedEvent ? (
                            <>
                              <Link2 size={14} className="text-[#63864B]" />
                              <span className="text-[#587345]">
                                Linked to {linkedEvent.name}
                              </span>
                            </>
                          ) : (
                            <span className="rounded-full bg-[#F0F1ED] px-2.5 py-1 text-[#6E786A]">
                              Standalone or unlinked plan
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-xs text-[#929B90]">
                          Saved{" "}
                          {new Date(saved.savedAt).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>

                        <button
                          onClick={() => openSavedPlan(saved)}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#172922] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#294438]"
                        >
                          <BookOpen size={16} />
                          Open saved plan
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#E4E9DF] bg-[#EFF4E9] p-4">
          <Lightbulb
            size={19}
            className="mt-0.5 shrink-0 text-[#708A52]"
          />
          <p className="text-xs leading-6 text-[#657460]">
            <strong>Storage note:</strong> Events, tasks and AI plans are
            synchronized to your authenticated Supabase workspace and cached
            locally. Cross-device access depends on successful cloud
            synchronization.
          </p>
        </div>

        <footer className="mt-12 border-t border-[#E6EAE2] pt-6 text-center text-xs text-[#929B90]">
          Planora AI · Thoughtful planning, beautiful moments.
        </footer>
      </div>
    </main>
  );
}

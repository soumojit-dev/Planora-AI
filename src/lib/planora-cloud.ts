"use client";

import { createClient } from "@/lib/supabase/client";

const EVENT_STORAGE_KEY = "planora-events-v1";
const PLAN_STORAGE_KEY = "planora-ai-plans-v1";
const OWNER_STORAGE_KEY = "planora-local-owner-v1";

const userEventsCacheKey = (userId: string) =>
  `${EVENT_STORAGE_KEY}:user:${userId}`;

const userPlansCacheKey = (userId: string) =>
  `${PLAN_STORAGE_KEY}:user:${userId}`;

export type EventType = "Wedding" | "Birthday" | "Community Event";

export type PlanoraTask = {
  id: string;
  title: string;
  done: boolean;
};

export type PlanoraEvent = {
  id: string;
  name: string;
  type: EventType;
  date: string;
  location: string;
  guests: number;
  budget: number;
  tasks: PlanoraTask[];
};

export type PlanoraSavedPlan = {
  id: string;
  eventId: string | null;
  eventName: string;
  eventType: EventType;
  date: string;
  location: string;
  guests: number;
  budget: number;
  priorities: string;
  plan: string;
  savedAt: string;
};

type DbEvent = {
  id: string;
  user_id: string;
  local_id: string | null;
  name: string;
  event_type: EventType;
  event_date: string;
  location: string;
  guests: number;
  budget: number | string;
  created_at: string;
};

type DbTask = {
  id: string;
  event_id: string;
  local_id: string | null;
  title: string;
  completed: boolean;
  sort_order: number;
};

type DbPlan = {
  id: string;
  user_id: string;
  event_id: string | null;
  local_id: string | null;
  event_name: string;
  event_type: EventType;
  event_date: string;
  location: string;
  guests: number;
  budget: number | string;
  priorities: string;
  plan: string;
  created_at: string;
};

type SupabaseClient = ReturnType<typeof createClient>;

function isEventType(value: unknown): value is EventType {
  return (
    value === "Wedding" ||
    value === "Birthday" ||
    value === "Community Event"
  );
}

function isTask(value: unknown): value is PlanoraTask {
  if (typeof value !== "object" || value === null) return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.done === "boolean"
  );
}

function isPlanoraEvent(value: unknown): value is PlanoraEvent {
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
    item.tasks.every(isTask)
  );
}

function isPlanoraSavedPlan(value: unknown): value is PlanoraSavedPlan {
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

function readLocalArray(key: string): unknown[] {
  const raw = window.localStorage.getItem(key);

  if (!raw) return [];

  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(
      `Saved data in ${key} is not a valid array. The original data was not overwritten.`
    );
  }

  return parsed;
}

function checkError(
  operation: string,
  error: { message: string } | null
) {
  if (error) {
    throw new Error(`${operation}: ${error.message}`);
  }
}

async function requireUser() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("Please sign in before accessing cloud storage.");
  }

  return { supabase, user: data.user };
}

/**
 * Activate the browser cache belonging to the current user.
 *
 * When an account changes, the previous user's cache is archived under
 * that user's own key before the current user's cache is activated.
 * An account's unowned local data is claimed only by the first account
 * that begins the initial migration.
 */
function prepareLocalCacheForUser(userId: string): boolean {
  const previousOwner =
    window.localStorage.getItem(OWNER_STORAGE_KEY);

  if (previousOwner && previousOwner !== userId) {
    const previousEvents =
      window.localStorage.getItem(EVENT_STORAGE_KEY);

    const previousPlans =
      window.localStorage.getItem(PLAN_STORAGE_KEY);

    if (previousEvents !== null) {
      window.localStorage.setItem(
        userEventsCacheKey(previousOwner),
        previousEvents
      );
    }

    if (previousPlans !== null) {
      window.localStorage.setItem(
        userPlansCacheKey(previousOwner),
        previousPlans
      );
    }

    // Never expose one account's active browser cache to another account.
    const currentUserEvents =
      window.localStorage.getItem(userEventsCacheKey(userId));

    const currentUserPlans =
      window.localStorage.getItem(userPlansCacheKey(userId));

    window.localStorage.setItem(
      EVENT_STORAGE_KEY,
      currentUserEvents ?? "[]"
    );

    window.localStorage.setItem(
      PLAN_STORAGE_KEY,
      currentUserPlans ?? "[]"
    );

    window.localStorage.setItem(OWNER_STORAGE_KEY, userId);

    // Only this user's previously archived data may be imported.
    return currentUserEvents !== null || currentUserPlans !== null;
  }

  if (!previousOwner) {
    // Claim existing legacy browser data before attempting its migration.
    // This prevents another account from claiming it if a request fails.
    window.localStorage.setItem(OWNER_STORAGE_KEY, userId);
  }

  return true;
}

function findCloudEvent(
  events: DbEvent[],
  localId: string
): DbEvent | undefined {
  return events.find(
    (event) => event.local_id === localId || event.id === localId
  );
}

function toLocalEvent(
  event: DbEvent,
  tasks: DbTask[]
): PlanoraEvent {
  return {
    id: event.local_id ?? event.id,
    name: event.name,
    type: event.event_type,
    date: event.event_date,
    location: event.location,
    guests: Number(event.guests),
    budget: Number(event.budget),
    tasks: tasks
      .filter((task) => task.event_id === event.id)
      .map((task) => ({
        id: task.local_id ?? task.id,
        title: task.title,
        done: task.completed,
      })),
  };
}

function toLocalPlan(
  plan: DbPlan,
  events: DbEvent[]
): PlanoraSavedPlan {
  const linkedEvent = plan.event_id
    ? events.find((event) => event.id === plan.event_id)
    : undefined;

  return {
    id: plan.local_id ?? plan.id,
    eventId: linkedEvent
      ? linkedEvent.local_id ?? linkedEvent.id
      : null,
    eventName: plan.event_name,
    eventType: plan.event_type,
    date: plan.event_date,
    location: plan.location,
    guests: Number(plan.guests),
    budget: Number(plan.budget),
    priorities: plan.priorities ?? "",
    plan: plan.plan,
    savedAt: plan.created_at,
  };
}

async function fetchCloudEvents(
  supabase: SupabaseClient,
  userId: string
): Promise<DbEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, user_id, local_id, name, event_type, event_date, location, guests, budget, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  checkError("Unable to load cloud events", error);

  return (data ?? []) as unknown as DbEvent[];
}

async function fetchCloudTasks(
  supabase: SupabaseClient
): Promise<DbTask[]> {
  const { data, error } = await supabase
    .from("event_tasks")
    .select("id, event_id, local_id, title, completed, sort_order")
    .order("sort_order", { ascending: true });

  checkError("Unable to load cloud checklist tasks", error);

  return (data ?? []) as unknown as DbTask[];
}

async function fetchCloudPlans(
  supabase: SupabaseClient,
  userId: string
): Promise<DbPlan[]> {
  const { data, error } = await supabase
    .from("ai_plans")
    .select(
      "id, user_id, event_id, local_id, event_name, event_type, event_date, location, guests, budget, priorities, plan, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  checkError("Unable to load cloud AI plans", error);

  return (data ?? []) as unknown as DbPlan[];
}

/**
 * Imports legacy browser data into the signed-in user's cloud workspace,
 * loads the cloud workspace and refreshes the browser cache.
 *
 * Repeating the operation is safe for rows carrying local_id because the
 * database has unique constraints on the associated user/event and local_id.
 */
export async function loadAndSyncPlanoraData(): Promise<{
  events: PlanoraEvent[];
  plans: PlanoraSavedPlan[];
}> {
  const { supabase, user } = await requireUser();

  const canImportLocal = prepareLocalCacheForUser(user.id);

  // Parse before performing migrations. If parsing fails, do not overwrite it.
  const localEvents = (
    canImportLocal ? readLocalArray(EVENT_STORAGE_KEY) : []
  ).filter(isPlanoraEvent);

  const localPlans = (
    canImportLocal ? readLocalArray(PLAN_STORAGE_KEY) : []
  ).filter(isPlanoraSavedPlan);

  let cloudEvents = await fetchCloudEvents(supabase, user.id);

  const existingEventKeys = new Set(
    cloudEvents.flatMap((event) =>
      [event.local_id, event.id].filter(
        (key): key is string => Boolean(key)
      )
    )
  );

  const eventsToImport = localEvents.filter(
    (event) => !existingEventKeys.has(event.id)
  );

  if (eventsToImport.length > 0) {
    const rows = eventsToImport.map((event) => ({
      user_id: user.id,
      local_id: event.id,
      name: event.name,
      event_type: event.type,
      event_date: event.date,
      location: event.location,
      guests: event.guests,
      budget: event.budget,
    }));

    const { error } = await supabase
      .from("events")
      .upsert(rows, {
        onConflict: "user_id,local_id",
        ignoreDuplicates: true,
      });

    checkError("Unable to import your existing events", error);
  }

  cloudEvents = await fetchCloudEvents(supabase, user.id);

  const cloudTasks = await fetchCloudTasks(supabase);
  const taskImportRows: {
    event_id: string;
    local_id: string;
    title: string;
    completed: boolean;
    sort_order: number;
  }[] = [];

  for (const event of localEvents) {
    const cloudEvent = findCloudEvent(cloudEvents, event.id);

    if (!cloudEvent) continue;

    const existingTaskKeys = new Set(
      cloudTasks
        .filter((task) => task.event_id === cloudEvent.id)
        .flatMap((task) =>
          [task.local_id, task.id].filter(
            (key): key is string => Boolean(key)
          )
        )
    );

    event.tasks.forEach((task, index) => {
      if (!existingTaskKeys.has(task.id)) {
        taskImportRows.push({
          event_id: cloudEvent.id,
          local_id: task.id,
          title: task.title,
          completed: task.done,
          sort_order: index,
        });
      }
    });
  }

  if (taskImportRows.length > 0) {
    const { error } = await supabase
      .from("event_tasks")
      .upsert(taskImportRows, {
        onConflict: "event_id,local_id",
        ignoreDuplicates: true,
      });

    checkError("Unable to import your existing checklist tasks", error);
  }

  cloudEvents = await fetchCloudEvents(supabase, user.id);

  let cloudPlans = await fetchCloudPlans(supabase, user.id);

  const existingPlanKeys = new Set(
    cloudPlans.flatMap((item) =>
      [item.local_id, item.id].filter(
        (key): key is string => Boolean(key)
      )
    )
  );

  const plansToImport = localPlans.filter(
    (plan) => !existingPlanKeys.has(plan.id)
  );

  if (plansToImport.length > 0) {
    const rows = plansToImport.map((plan) => {
      const linkedEvent = plan.eventId
        ? findCloudEvent(cloudEvents, plan.eventId)
        : undefined;

      return {
        user_id: user.id,
        local_id: plan.id,
        event_id: linkedEvent?.id ?? null,
        event_name: plan.eventName,
        event_type: plan.eventType,
        event_date: plan.date,
        location: plan.location,
        guests: plan.guests,
        budget: plan.budget,
        priorities: plan.priorities,
        plan: plan.plan,
      };
    });

    const { error } = await supabase
      .from("ai_plans")
      .upsert(rows, {
        onConflict: "user_id,local_id",
        ignoreDuplicates: true,
      });

    checkError("Unable to import your saved AI plans", error);
  }

  // Fetch again to include all successfully imported records.
  cloudEvents = await fetchCloudEvents(supabase, user.id);

  const syncedTasks = await fetchCloudTasks(supabase);

  cloudPlans = await fetchCloudPlans(supabase, user.id);

  const events = cloudEvents.map((event) =>
    toLocalEvent(event, syncedTasks)
  );

  const plans = cloudPlans
    .slice(0, 50)
    .map((plan) => toLocalPlan(plan, cloudEvents));

  // Cache the active user's workspace only after cloud loading succeeds.
  try {
    const eventsJson = JSON.stringify(events);
    const plansJson = JSON.stringify(plans);

    window.localStorage.setItem(EVENT_STORAGE_KEY, eventsJson);
    window.localStorage.setItem(PLAN_STORAGE_KEY, plansJson);
    window.localStorage.setItem(OWNER_STORAGE_KEY, user.id);

    window.localStorage.setItem(
      userEventsCacheKey(user.id),
      eventsJson
    );

    window.localStorage.setItem(
      userPlansCacheKey(user.id),
      plansJson
    );
  } catch (error) {
    console.warn(
      "Cloud data loaded, but the browser cache could not be updated.",
      error
    );
  }

  return { events, plans };
}

function assertActiveLocalOwner(userId: string) {
  const currentOwner = window.localStorage.getItem(OWNER_STORAGE_KEY);

  if (currentOwner && currentOwner !== userId) {
    throw new Error(
      "The browser cache belongs to another account. Reload the workspace before saving."
    );
  }

  if (!currentOwner) {
    window.localStorage.setItem(OWNER_STORAGE_KEY, userId);
  }
}

/**
 * Save an event and upsert its current checklist into Supabase.
 */
export async function saveEventAndTasksToCloud(
  event: PlanoraEvent
): Promise<void> {
  const { supabase, user } = await requireUser();

  assertActiveLocalOwner(user.id);

  const { data: savedEvent, error: eventError } = await supabase
    .from("events")
    .upsert(
      {
        user_id: user.id,
        local_id: event.id,
        name: event.name,
        event_type: event.type,
        event_date: event.date,
        location: event.location,
        guests: event.guests,
        budget: event.budget,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,local_id" }
    )
    .select("id")
    .single();

  checkError("Unable to save the event", eventError);

  if (!savedEvent) {
    throw new Error("Supabase did not return the saved event.");
  }

  if (event.tasks.length === 0) return;

  const rows = event.tasks.map((task, index) => ({
    event_id: savedEvent.id,
    local_id: task.id,
    title: task.title,
    completed: task.done,
    sort_order: index,
  }));

  const { error: taskError } = await supabase
    .from("event_tasks")
    .upsert(rows, {
      onConflict: "event_id,local_id",
    });

  checkError("Unable to save checklist progress", taskError);
}

/**
 * Save a generated AI plan and link it to the current user's cloud event.
 */
export async function savePlanToCloud(
  plan: PlanoraSavedPlan
): Promise<void> {
  const { supabase, user } = await requireUser();

  assertActiveLocalOwner(user.id);

  let cloudEventId: string | null = null;

  if (plan.eventId) {
    const cloudEvents = await fetchCloudEvents(supabase, user.id);
    const linkedEvent = findCloudEvent(cloudEvents, plan.eventId);

    if (linkedEvent) {
      cloudEventId = linkedEvent.id;
    } else {
      throw new Error(
        "The linked dashboard event was not found in your cloud workspace. Sync the event first."
      );
    }
  }

  const { error } = await supabase
    .from("ai_plans")
    .upsert(
      {
        user_id: user.id,
        local_id: plan.id,
        event_id: cloudEventId,
        event_name: plan.eventName,
        event_type: plan.eventType,
        event_date: plan.date,
        location: plan.location,
        guests: plan.guests,
        budget: plan.budget,
        priorities: plan.priorities,
        plan: plan.plan,
      },
      { onConflict: "user_id,local_id" }
    );

  checkError("Unable to save the AI plan", error);
}
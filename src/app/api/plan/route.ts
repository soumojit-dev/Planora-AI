
import { GoogleGenAI } from "@google/genai";

const allowedEventTypes = [
  "Wedding",
  "Birthday",
  "Community Event",
] as const;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid request. Please submit valid event details." },
      { status: 400 }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    return Response.json(
      { error: "The event details are missing or invalid." },
      { status: 400 }
    );
  }

  const data = body as Record<string, unknown>;

  const eventType = data.eventType;
  const eventName =
    typeof data.eventName === "string" ? data.eventName.trim() : "";
  const date = typeof data.date === "string" ? data.date.trim() : "";
  const location =
    typeof data.location === "string" ? data.location.trim() : "";
  const guests = Number(data.guests);
  const budget = Number(data.budget);
  const priorities =
    typeof data.priorities === "string"
      ? data.priorities.trim().slice(0, 1000)
      : "";

  if (
    typeof eventType !== "string" ||
    !allowedEventTypes.includes(
      eventType as (typeof allowedEventTypes)[number]
    ) ||
    !eventName ||
    eventName.length > 100 ||
    !date ||
    date.length > 30 ||
    !location ||
    location.length > 120 ||
    !Number.isInteger(guests) ||
    guests < 1 ||
    guests > 1000000 ||
    !Number.isFinite(budget) ||
    budget < 1 ||
    budget > 1000000000
  ) {
    return Response.json(
      {
        error:
          "Please provide a valid event type, name, date, location, guest count and budget.",
      },
      { status: 400 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        error:
          "The Gemini API key is not configured. Add GEMINI_API_KEY to .env.local and restart the development server.",
      },
      { status: 500 }
    );
  }

  const prompt = `
You are Planora AI, a practical and creative event planning assistant.

Create a personalized, actionable plan for the event described below.

EVENT DETAILS
Event type: ${eventType}
Event name: ${eventName}
Date: ${date}
Location: ${location}
Expected guests: ${guests}
Total budget: INR ${budget}
Additional preferences: ${priorities || "No additional preferences provided."}

YOUR TASK

1. EVENT CONCEPT
Suggest a suitable theme, atmosphere and overall experience.

2. BUDGET BREAKDOWN
Provide an itemized budget in Indian rupees.
Include venue, food and catering, decoration, photography,
entertainment, logistics and a contingency reserve where appropriate.
Adapt the categories to the event type.
Treat all prices as estimates, and ensure the proposed total
does not exceed the user's stated budget.
Explain where money could be saved.

3. PLANNING TIMELINE
List important milestones leading up to the event date.
Use dates or sensible relative deadlines.
Identify tasks that need immediate attention.

4. VENDOR CHECKLIST
List relevant vendor categories, questions to ask each vendor,
when to contact them and what to confirm in writing.
Do not invent actual vendors or claim availability is verified.

5. EVENT-DAY SCHEDULE
Provide a practical sequence of activities with approximate times.

6. PERSONALIZED IDEAS
Suggest at least five ideas suited to the budget, location,
audience and stated preferences.

7. RISKS AND NEXT ACTIONS
Identify possible overspending and logistical issues.
Finish with the five highest-priority next actions.

IMPORTANT RULES
- Use clear English and Indian rupees.
- Respect the stated budget and guest count.
- Present prices as estimates, not verified quotations.
- Clearly identify assumptions when details are missing.
- Make the plan realistic and specific to the event.
- Use readable headings and numbered lists.
`;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const result = await ai.interactions.create({
      model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
      input: prompt,
    });

    const plan = result.output_text?.trim();

    if (!plan) {
      return Response.json(
        { error: "The AI returned an empty plan. Please try again." },
        { status: 502 }
      );
    }

    return Response.json({ plan });
  } catch (error) {
    console.error("Planora AI: Gemini request failed.", error);

    return Response.json(
      {
        error:
          "Gemini could not generate your plan. Check your API key, model access, internet connection and API quota, then try again.",
      },
      { status: 502 }
    );
  }
}

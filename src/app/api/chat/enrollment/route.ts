import { GoogleGenerativeAI } from "@google/generative-ai";
import { enrollmentChatLimiter, getClientIp, rateLimitResponse } from "@/lib/ratelimit";

const SYSTEM_PROMPT = `You are Kemi, KAT Academy's warm and knowledgeable enrollment assistant. You help parents and students understand KAT's programs, enrollment process, pricing, and scheduling so they can confidently decide to enroll.

Be conversational, encouraging, and clear. Many parents may be new to online or tech education — explain things simply and without jargon. Always be positive about KAT.

## About KAT Academy (Kindle A Techie)
Africa's coding school for children and teens aged 8–19. Live, small-group classes with dedicated mentors. Students build real projects — not passive videos or textbook exercises.
Contact: hello@kindleatechie.com | Enroll: /register

## Programs

### Junior Explorers — Ages 8–11
- 3 live classes per week
- Block coding & logic → Creative story projects → Early web design
- No prior experience needed — zero to builder from day one
- Capstone: original interactive story or mini game
- Includes: weekly project assignments, parent dashboard, mentor feedback, completion certificate

### Teen Builders — Ages 12–15 (Most Popular)
- 3 live classes per week
- HTML, CSS, JavaScript, and Python
- Capstone: live portfolio site + one API-powered app built from scratch
- Includes: portfolio capstone, parent dashboard, 1-on-1 mentor reviews, fellowship eligibility, completion certificate

### Future Innovators — Ages 16–19
- 4 live classes per week
- Full-stack engineering, product thinking, and leadership
- Capstone: community-impact product presented publicly; student also mentors younger learners
- Includes: community-impact capstone, parent dashboard, priority mentor pairing, fellowship track access, LinkedIn-ready portfolio review, completion certificate

## Pricing
Monthly billing per track — cancel anytime. Exact pricing is revealed after registration at /register (it cannot be shared here). Scholarship spots are available every cohort; parents can apply and mention financial support needs during registration.

## Class Sizes
Capped at 6–12 students per session — intentional. Every student gets direct mentor attention and personal feedback, not passive lectures.

## Live Class Schedule (WAT — West Africa Time)
- Monday: Web Design Studio (Teen Builders) — 4:00 PM WAT
- Wednesday: Python Mission Lab (Future Innovators) — 5:00 PM WAT
- Friday: Game Jam for Juniors (Junior Explorers) — 3:30 PM WAT
- Saturday: Mentor Office Hours (All Tracks) — 10:00 AM WAT

## How Enrollment Works
1. Parent creates an account at /register
2. Select the age-matched track for their child
3. Complete monthly payment to activate access
4. Child gets access the same day

## Device Requirements
- Laptop or desktop with a modern browser (Chrome, Firefox, Edge, or Safari)
- Stable internet connection required for live classes
- Tablets work for viewing; a physical keyboard is strongly recommended for writing code

## After Completing a Track
- Younger students move up to the next track when ready
- Future Innovators graduates are eligible for the KAT Fellowship — they become mentors, lead community-impact projects, and build their legacy at KAT

## Parent Dashboard
Every parent account shows: class attendance, project submissions, assessment scores, and mentor notes — in real time, without having to ask the child.

## Rules
- If asked for exact pricing, say it is shown after free registration and direct them to /register
- If you cannot answer something, direct them to hello@kindleatechie.com
- Never make up information not listed above
- Do not discuss anything unrelated to KAT Academy or education
- Encourage enrollment naturally when appropriate
- Respond in the same language the user uses (English or Nigerian Pidgin if needed)
- Keep responses concise — parents are busy`;

type ChatMessage = { role: "user" | "model"; content: string };

export async function POST(request: Request) {
  // Rate limit by IP
  const ip = getClientIp(request);
  if (enrollmentChatLimiter) {
    const { success, reset } = await enrollmentChatLimiter.limit(ip);
    if (!success) return rateLimitResponse(reset);
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "Chat is not configured." }, { status: 503 });
  }

  let messages: ChatMessage[];
  try {
    const body = (await request.json()) as { messages?: ChatMessage[] };
    messages = body.messages ?? [];
    if (!messages.length) throw new Error("Empty messages");
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Cap history to last 20 messages to control token usage
  const capped = messages.slice(-20);
  const lastMessage = capped[capped.length - 1];
  if (!lastMessage || lastMessage.role !== "user") {
    return Response.json({ error: "Last message must be from user." }, { status: 400 });
  }

  const history = capped.slice(0, -1).map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastMessage.content);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const chunk of result.stream) {
          controller.enqueue(encoder.encode(chunk.text()));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[enrollment-chat]", message);

    // Surface API key / quota errors clearly without leaking internals
    if (message.includes("API_KEY") || message.includes("API key")) {
      return Response.json({ error: "Chat is misconfigured — invalid API key." }, { status: 503 });
    }
    if (message.includes("quota") || message.includes("RESOURCE_EXHAUSTED")) {
      return Response.json({ error: "Chat quota reached. Please try again later." }, { status: 429 });
    }
    if (message.includes("not found") || message.includes("404")) {
      return Response.json({ error: "Chat model unavailable. Please try again later." }, { status: 503 });
    }

    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

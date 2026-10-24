import OpenAI from "openai";

export const maxDuration = 30;

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const MODEL = "openai/gpt-oss-20b";

const INSTRUCTIONS = `You are a call analyst. You will be given the transcript of a finished customer support call between a customer and Aria, the voice agent of Aura Skincare. Do NOT continue the conversation and do NOT reply as Aria or the customer. Only analyse the transcript.

Return ONLY a JSON object with exactly these keys:
- "customer_intent": one of ORDER_TRACKING, ORDER_CANCELLATION, RETURN_REFUND, POLICY_QUESTION, OUT_OF_SCOPE, OTHER
- "order_ids": a list of every order ID discussed in the call, like ["ORD-101", "ORD-102"], or an empty list if none
- "resolution_status": one of RESOLVED, UNRESOLVED, ESCALATED
- "call_summary": 1 to 2 plain sentences describing what the customer wanted and what happened

Use RESOLVED only if the customer got a clear answer or outcome. Use UNRESOLVED if the question was not answered or the request could not be fulfilled. Use ESCALATED if the customer was told that the support team will handle it. If the customer asked about several topics, choose the intent of the main request and mention the others in call_summary.`;

const REQUIRED = ["customer_intent", "resolution_status", "call_summary"];

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages.some((m: any) => m.role === "user")) {
      return Response.json({
        customer_intent: "OTHER",
        order_ids: [],
        resolution_status: "UNRESOLVED",
        call_summary: "The customer ended the call without saying anything.",
      });
    }

    const convo = messages
      .map((m: any) => `${m.role === "user" ? "Customer" : "Aria"}: ${m.content}`)
      .join("\n");

    const userContent =
      `Here is the call transcript.\n\n<transcript>\n${convo}\n</transcript>\n\n` +
      `Now output ONLY the JSON object described in your instructions. ` +
      `Do not continue the conversation.`;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await client.chat.completions.create({
          model: MODEL,
          messages: [
            { role: "system", content: INSTRUCTIONS },
            { role: "user", content: userContent },
          ],
          temperature: 0,
          max_tokens: attempt === 1 ? 2000 : 3500,
          ...(attempt === 1 ? { response_format: { type: "json_object" as const } } : {}),
          ...({ reasoning_effort: "medium" } as any),
        });

        const raw = res.choices[0].message.content ?? "";
        const clean = raw.replace(/```json|```/g, "").trim();
        const start = clean.indexOf("{");
        const end = clean.lastIndexOf("}");
        if (start === -1 || end === -1) {
          throw new Error(`No JSON in reply (finish_reason: ${res.choices[0].finish_reason})`);
        }

        const parsed = JSON.parse(clean.slice(start, end + 1));
        const missing = REQUIRED.filter((k) => !(k in parsed));
        if (missing.length > 0) {
          throw new Error(`Reply is missing keys: ${missing.join(", ")}`);
        }
        if (!Array.isArray(parsed.order_ids)) parsed.order_ids = [];

        return Response.json({
          customer_intent: parsed.customer_intent,
          order_ids: parsed.order_ids,
          resolution_status: parsed.resolution_status,
          call_summary: parsed.call_summary,
        });
      } catch (err: any) {
        console.error(`Summary attempt ${attempt} failed:`, err?.status, err?.message);
        if (attempt === 3) throw err;
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    throw new Error("Summary failed");
  } catch (e) {
    console.error("Summary error:", e);
    return Response.json({ error: "Could not generate the summary." }, { status: 500 });
  }
}
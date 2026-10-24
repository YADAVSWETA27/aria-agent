import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const MODEL = "PASTE_THE_SAME_MODEL_NAME_AS_CHAT_ROUTE";

const INSTRUCTIONS = `You analyse a finished customer support call between a customer and Aria, the voice agent of Aura Skincare. Return ONLY a JSON object with exactly these keys:
- "customer_intent": one of ORDER_TRACKING, ORDER_CANCELLATION, RETURN_REFUND, POLICY_QUESTION, OUT_OF_SCOPE, OTHER
- "order_id": the order ID discussed, like "ORD-101", or null if none
- "resolution_status": one of RESOLVED, UNRESOLVED, ESCALATED
- "call_summary": 1 to 2 plain sentences describing what the customer wanted and what happened

Use RESOLVED only if the customer got a clear answer or outcome. Use UNRESOLVED if the question was not answered or the request could not be fulfilled. Use ESCALATED if the customer was told to contact the support team.`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages.some((m: any) => m.role === "user")) {
      return Response.json({
        customer_intent: "OTHER",
        order_id: null,
        resolution_status: "UNRESOLVED",
        call_summary: "The customer ended the call without saying anything.",
      });
    }

    const convo = messages
      .map((m: any) => `${m.role === "user" ? "Customer" : "Aria"}: ${m.content}`)
      .join("\n");

    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: INSTRUCTIONS },
        { role: "user", content: convo },
      ],
      temperature: 0,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const raw = res.choices[0].message.content ?? "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    return Response.json(JSON.parse(clean));
  } catch (e) {
    console.error("Summary error:", e);
    return Response.json({ error: "Could not generate the summary." }, { status: 500 });
  }
}
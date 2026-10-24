import OpenAI from "openai";
import { getOrderDetails } from "@/lib/orders";
import { SYSTEM_PROMPT } from "@/lib/prompt";

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const MODEL = "openai/gpt-oss-20b";
function cleanForSpeech(text: string) {
  return text
    .replace(/[\u2010-\u2015\u2212]/g, "-") // fancy hyphens/dashes -> "-"
    .replace(/[\u00A0\u202F\u2009\u200A]/g, " ") // odd spaces -> normal space
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[*_#`]/g, "") // stray markdown
    .trim();
}

const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_order_details",
      description:
        "Look up an Aura Skincare order by its order ID (like ORD-101). Call this whenever the customer asks about the status, tracking, cancellation or return of a specific order.",
      parameters: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "The order ID the customer gave, e.g. ORD-101",
          },
        },
        required: [],
      },
    },
  },
];

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const msgs: any[] = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

    for (let i = 0; i < 4; i++) {
      const res = await client.chat.completions.create({
        model: MODEL,
        messages: msgs,
        tools,
        tool_choice: "auto",
        max_tokens: 200,
        temperature: 0.4,
      });

      const msg = res.choices[0].message;

      // No tool needed: this is Aria's final spoken reply
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
                return Response.json({ text: cleanForSpeech(msg.content ?? "") });
      }

      // Tool needed: run it and feed the result back to the model
      msgs.push(msg);
      for (const call of msg.tool_calls as any[]) {
        let args: any = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {}
        const result = getOrderDetails(args.order_id);
        msgs.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    return Response.json({
      text: "Sorry, I'm having trouble with that. Could you please repeat?",
    });
  } catch (err) {
    console.error("Chat error:", err);
    return Response.json(
      { text: "Sorry, I'm having a technical problem. Please try again." },
      { status: 500 }
    );
  }
}
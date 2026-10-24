# Aria: AI Voice Support Agent for Aura Skincare

A browser-based voice customer support agent for a fictional D2C skincare brand. The customer clicks **Start conversation**, talks to Aria through the microphone, and hears her answer. Aria answers brand and policy questions, looks up live order data with a tool call, and produces a transcript and structured summary after the call.

- **Live app:** https://aria-agent-sigma.vercel.app
- **Repository:** https://github.com/YADAVSWETA27/aria-agent
- **Demo video:** _add link here_

## What it does

- Natural voice conversation in the browser, no phone number or telephony needed
- Indian-English voice and Indian-English speech recognition
- Answers from Aura Skincare brand policy (shipping, returns, cancellation, COD)
- `get_order_details` tool for live order lookup, with graceful handling of missing, unknown and ineligible orders
- Policy guardrails: refuses out-of-policy returns, declines off-topic requests, admits when it does not know
- Barge-in: talking over Aria stops her speaking
- Live state indicator (Listening, Thinking, Speaking)
- Test Orders panel on the page, so evaluators can try lookups immediately
- Post-call transcript and structured JSON summary

## Architecture

```
Browser (Next.js page)
  |  microphone audio (WebSocket, temporary token)
  v
Deepgram STT (nova-3, en-IN)  ---- text ---->  /api/chat
                                                  |
                                       LLM on Groq (tool calling)
                                                  |  get_order_details(order_id)
                                                  v
                                           lib/orders.ts (mock DB + eligibility rules)
                                                  |
Browser <---- audio ----  /api/tts  <---- Aria's reply text
                          (ElevenLabs, Indian female voice)

On End call: transcript --> /api/summary --> JSON outcome shown on the page
```

| Piece | Choice | Why |
|---|---|---|
| Frontend and backend | Next.js (App Router) on Vercel | One repo, one deploy, API routes keep keys secret |
| Speech to text | Deepgram nova-3 (`en-IN`) | Streaming, low latency, handles Indian English |
| LLM | Open-weights model on Groq (set in `app/api/chat/route.ts`) | Fast, free tier, supports tool calling |
| Text to speech | ElevenLabs Flash (voice created with Voice Design) | Natural Indian-accent voice |

### How the agent decides to use a tool
The model receives the system prompt (`lib/prompt.ts`) and a tool definition for `get_order_details`. When a customer asks about a specific order, the model emits a tool call. The server runs `getOrderDetails`, sends the result back to the model, and the model words the answer. The loop is capped at 4 rounds.

### How the guardrails work
1. **Policies live in the system prompt** (`lib/prompt.ts`), along with rules such as short spoken replies, no markdown, ask for the order ID if missing, and decline off-topic questions.
2. **Eligibility is decided in code, not by the model.** `getOrderDetails` returns `can_cancel`, `return_window_open` and `shipping_fee`, computed from order status and delivery date. The model is told to rely on these fields.
3. **Structured errors** (`MISSING_ID`, `NOT_FOUND`) make the agent ask the customer to repeat or verify the ID instead of inventing details.
4. **Output cleaning** (`cleanForSpeech`) strips odd Unicode characters and stray markdown so the voice reads text cleanly.

## Run it locally

```bash
git clone https://github.com/YADAVSWETA27/aria-agent.git
cd aria-agent
npm install
cp .env.example .env.local    # then fill in your keys
npm run dev
```

Open http://localhost:3000 in Chrome, click **Start conversation**, and allow the microphone. Headphones are recommended so Aria does not hear herself.

### Environment variables (`.env.example`)

| Name | Purpose |
|---|---|
| `DEEPGRAM_API_KEY` | Speech to text (used server-side to mint a short-lived browser token) |
| `GROQ_API_KEY` | LLM |
| `TTS_API_KEY` | ElevenLabs text to speech |
| `TTS_VOICE_ID` | ElevenLabs voice ID for Aria |

## Things to try

| Say | Expected |
|---|---|
| "Where is my order ORD-101?" | Out for delivery with BlueDart, by 6 PM |
| "Can I return ORD-102?" | Politely refused, delivered 14 days ago |
| "Please cancel ORD-103" | Eligible, because it is still Processing |
| "Cancel ORD-101" | Refused, already out for delivery; can refuse at the doorstep |
| "Where is ORD-999?" | Order not found, asks to verify the ID |
| "Book me a flight to Goa" | Declines, only handles Aura Skincare |
| Interrupt Aria mid-sentence | She stops speaking |

## Known limitations

- Aria cannot actually cancel or refund. She explains eligibility and says the request will be passed to the support team. A real cancel tool is a planned improvement.
- Replies are generated in full before being spoken, so there is a short pause after each question (see question 3 below).
- Orders are a mock in-memory database.
- Free-tier limits on the AI providers apply.

## How I think

### 1. Why did you choose this architecture and technology stack?
I chose a modular pipeline (speech to text, then LLM with tools, then text to speech) inside one Next.js app. It lets me pick the best Indian-accent voice and recognizer separately, and each stage can be explained, tested and swapped on its own. A realtime speech-to-speech API would give lower latency, but I would have had less control over the voice and over exactly when and how tools run. Next.js on Vercel gives me the frontend and the secret-holding API routes in one repo and one deploy, with a public HTTPS link (needed for the microphone). I used free tiers throughout. The Deepgram key never reaches the browser, because the server hands out a 60-second temporary token.

### 2. What was the most difficult part, and how did you solve it?
Making the conversation feel natural rather than just functional, and keeping the agent from saying things the brand cannot stand behind. On the voice side, I had to handle turn-taking (knowing when the customer has finished), interruption (stopping playback when they talk over her), and a bug where a double click opened two microphone connections and doubled every sentence; I fixed it with a guard against starting a call twice. On the policy side, my first version had Aria promise a refund that the policy does not mention. I fixed it by tightening the prompt, and by moving eligibility decisions into code (`can_cancel`, `return_window_open`) so the model reads facts instead of guessing. I also cleaned special characters from replies because they were being read badly.

### 3. If you had one more week, what would you improve first and why?
Latency, because it is what makes a voice agent feel human. Right now Aria waits for the whole reply before speaking. I would stream the model's output, split it at sentence boundaries, and send the first sentence to text to speech immediately. After that: a real `cancel_order` tool so cancellations complete instead of being forwarded, a repeatable test set for the guardrails (return after 20 days, flight request, wrong order ID, mumbling), and Hinglish support.

### 4. If this agent handled 1,000 conversations a day, what would change?
- **Reliability and cost:** move from free tiers to paid plans with rate limits and retries, add fallback providers, and cache audio for common phrases such as the greeting.
- **Real data and privacy:** replace the mock orders with a real order API, and verify the caller (for example, last digits of phone or email) before sharing order details, since anyone could otherwise guess an order ID.
- **Observability:** store transcripts and summaries in a database, and track latency per stage, tool-call errors, resolution rates and cost per call, with alerts.
- **Quality control:** run automated guardrail tests on every prompt or model change, and review a sample of real calls.
- **Human handoff:** a real escalation path to a person for upset customers or anything outside policy, instead of only suggesting it.
- **Scale:** the stateless API routes scale on Vercel, but concurrent audio streams and provider rate limits would need load testing, and a phone channel would need telephony infrastructure.
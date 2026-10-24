export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text || !text.trim()) {
      return new Response("No text", { status: 400 });
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.TTS_VOICE_ID}?output_format=mp3_44100_64`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.TTS_API_KEY as string,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_flash_v2_5",
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("TTS error:", res.status, err);
      return new Response(err, { status: res.status });
    }

    return new Response(res.body, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (e) {
    console.error("TTS error:", e);
    return new Response("TTS failed", { status: 500 });
  }
}
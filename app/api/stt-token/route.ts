export async function GET() {
  try {
    const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl_seconds: 60 }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Deepgram token error:", res.status, err);
      return Response.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    return Response.json({ token: data.access_token });
  } catch (e) {
    console.error("Deepgram token error:", e);
    return Response.json({ error: "Token failed" }, { status: 500 });
  }
}
import { NextResponse } from "next/server";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export async function POST(request: Request) {
  const rawKey = process.env.ANTHROPIC_API_KEY;
  const apiKey = typeof rawKey === "string" ? rawKey.trim() : "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "Enhancement is not configured (missing API key)." },
      { status: 503 }
    );
  }

  let body: { note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!note) {
    return NextResponse.json(
      { error: "Note is required." },
      { status: 400 }
    );
  }

  const userPrompt = `Clean up this voice-transcribed session completion note:

INPUT: ${note}

OUTPUT: Only the enhanced note, no preamble or explanation.`;

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system:
          "You are a construction field note editor for a commercial plumbing company. Clean up this voice-transcribed session completion note into clear, professional language. Keep it concise — 1-3 sentences max. Preserve all technical details, trade-specific terminology, inspection results, and next-step information. Do not add information that was not in the original. Fix grammar, remove filler words, and organize the key points clearly.",
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        (data.error?.message as string) || res.statusText || "Anthropic API error";
      const isAuthError =
        res.status === 401 || /invalid x-api-key|invalid api key/i.test(message);
      const isOverloaded =
        res.status === 503 || /overloaded|capacity|rate limit/i.test(message);
      const userMessage = isAuthError
        ? "Invalid Anthropic API key. Check ANTHROPIC_API_KEY in .env.local."
        : isOverloaded
        ? "AI service is temporarily busy. Please try again in a minute."
        : message;
      return NextResponse.json({ error: userMessage }, { status: 500 });
    }

    const content = data.content;
    if (!Array.isArray(content) || content.length === 0) {
      return NextResponse.json(
        { error: "No enhanced text returned." },
        { status: 500 }
      );
    }

    const text = content[0]?.text;
    if (typeof text !== "string") {
      return NextResponse.json(
        { error: "Invalid response format." },
        { status: 500 }
      );
    }

    return NextResponse.json({ enhanced: text.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Enhancement failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

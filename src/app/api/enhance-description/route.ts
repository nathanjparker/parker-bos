import { NextResponse } from "next/server";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Enhancement is not configured (missing API key)." },
      { status: 503 }
    );
  }

  let body: { description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) {
    return NextResponse.json(
      { error: "Description is required." },
      { status: 400 }
    );
  }

  const userPrompt = `Transform this field note into a professional change order description following these guidelines:

REQUIREMENTS:
- Be concise (2-3 sentences maximum)
- Lead with the primary change/addition
- Include specific quantities, locations, and materials when mentioned
- Use professional construction terminology
- State reason for change if provided (customer request, code requirement, field condition, etc.)
- Remove filler words, casual language, and abbreviations
- Maintain factual accuracy - don't add information not in the original

TONE: Professional but clear, suitable for contractor-client communication

INPUT: ${description}

OUTPUT: Only the enhanced description, no preamble or explanation.`;

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
        system: "You are a professional construction documentation assistant specializing in change order descriptions. Your goal is to transform rough field notes into clear, professional descriptions that satisfy both internal documentation needs and client-facing communication standards.",
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = (data.error?.message as string) || res.statusText || "Anthropic API error";
      return NextResponse.json(
        { error: message },
        { status: 500 }
      );
    }

    const content = data.content;
    if (!Array.isArray(content) || content.length === 0) {
      return NextResponse.json(
        { error: "No enhanced text returned." },
        { status: 500 }
      );
    }

    const firstBlock = content[0];
    const text = firstBlock?.text;
    if (typeof text !== "string") {
      return NextResponse.json(
        { error: "Invalid response format." },
        { status: 500 }
      );
    }

    return NextResponse.json({ enhanced: text.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Enhancement failed.";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

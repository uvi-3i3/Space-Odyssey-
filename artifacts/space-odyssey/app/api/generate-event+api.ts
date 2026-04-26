import { ExpoRequest, ExpoResponse } from 'expo-router/server';

const SYSTEM_PROMPT = `You are a narrative engine for a space idle RPG. Generate dramatic events based on the player's civilization state. Respond ONLY with valid JSON (no markdown, no explanation). Use this exact structure:
{"id":"ai_evt_XXXXX","title":"Short Title","description":"2 vivid sentences.","type":"random|story|discovery|threat","choices":[{"id":"c1","text":"Action verb phrase","consequence":"Outcome.","resourceChanges":{"Fe":50}},{"id":"c2","text":"Action verb phrase","consequence":"Outcome.","resourceChanges":{"credits":-30}},{"id":"c3","text":"Action verb phrase","consequence":"Outcome."}]}
Rules: exactly 3 choices, resourceChanges keys are element symbols (H,He,Li,C,O,Fe,Cu,Ag,Au,Pt,U,Pu,Ti,Si) or "credits", amounts -200 to +200, optional reputationChange -30 to +30.`;

export async function POST(request: ExpoRequest): Promise<Response> {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    return Response.json(
      { error: 'AI integration not configured' },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    era = 1,
    elementsDiscovered = [],
    buildingsBuilt = [],
    technologiesResearched = [],
    credits = 0,
    population = 10,
    factionNames = [],
    recentEventTitle,
  } = body as {
    era?: number;
    elementsDiscovered?: string[];
    buildingsBuilt?: string[];
    technologiesResearched?: string[];
    credits?: number;
    population?: number;
    factionNames?: string[];
    recentEventTitle?: string;
  };

  const eraNames = ['', 'Stone Age', 'Bronze Age', 'Industrial', 'Atomic'];
  const context = [
    `Era: ${era} (${eraNames[era as number] ?? 'Advanced'})`,
    `Elements discovered: ${(elementsDiscovered as string[]).join(', ') || 'only Hydrogen'}`,
    `Buildings: ${(buildingsBuilt as string[]).join(', ') || 'none yet'}`,
    `Technologies: ${(technologiesResearched as string[]).join(', ') || 'none yet'}`,
    `Credits: ${Math.floor(credits as number)}`,
    `Population: ${population}`,
    `Known factions: ${(factionNames as string[]).join(', ') || 'none yet'}`,
    recentEventTitle ? `Recent event: "${recentEventTitle}" (generate something different)` : '',
  ].filter(Boolean).join('\n');

  try {
    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Generate a narrative event for this civilization:\n\n${context}\n\nScale difficulty and rewards to era level ${era}.`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', aiResponse.status, errorText);
      return Response.json({ error: 'AI generation failed' }, { status: 502 });
    }

    const completion = await aiResponse.json() as {
      choices: Array<{ message: { content: string | null }; finish_reason?: string }>;
      error?: { message: string };
    };

    if (completion.error) {
      console.error('OpenAI error:', completion.error.message);
      return Response.json({ error: 'AI generation failed' }, { status: 502 });
    }

    const raw = completion.choices?.[0]?.message?.content ?? '';

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON in response:', raw.slice(0, 200));
      return Response.json({ error: 'Failed to parse event' }, { status: 500 });
    }

    let event;
    try {
      event = JSON.parse(jsonMatch[0]);
    } catch {
      console.error('JSON parse failed');
      return Response.json({ error: 'Failed to parse event' }, { status: 500 });
    }

    if (!event.id) event.id = `ai_evt_${Math.random().toString(36).slice(2, 8)}`;
    if (!Array.isArray(event.choices) || event.choices.length === 0) {
      return Response.json({ error: 'Invalid event structure' }, { status: 500 });
    }

    return Response.json(event);
  } catch (err) {
    console.error('Event generation error:', err);
    return Response.json({ error: 'Event generation failed' }, { status: 500 });
  }
}

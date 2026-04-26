import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/game/generate-event", async (req, res) => {
  const {
    era,
    elementsDiscovered,
    buildingsBuilt,
    technologiesResearched,
    credits,
    population,
    factionNames = [],
    recentEventTitle,
  } = req.body;

  const context = `
Current civilization state:
- Era: ${era} (1=Stone Age, 2=Bronze Age, 3=Industrial, 4=Atomic)
- Elements discovered: ${elementsDiscovered.join(", ") || "only Hydrogen"}
- Buildings: ${buildingsBuilt.join(", ") || "none yet"}
- Technologies researched: ${technologiesResearched.join(", ") || "none yet"}
- Credits: ${Math.floor(credits)}
- Population: ${population}
- Known alien factions: ${factionNames.join(", ") || "none yet"}
${recentEventTitle ? `- Recent event: "${recentEventTitle}" (generate something different)` : ""}
`.trim();

  const systemPrompt = `You are the narrative engine for "Space Odyssey: Galactic Evolution", a mobile idle RPG set in deep space. Generate immersive, dramatic narrative events that feel consistent with the player's current civilization state. Keep descriptions vivid but concise (2-3 sentences max). Make choices feel meaningful and distinct.

IMPORTANT: Respond ONLY with valid JSON matching this exact structure:
{
  "id": "evt_<random 6 char alphanumeric>",
  "title": "Event Title (5-7 words)",
  "description": "2-3 vivid sentences describing the situation.",
  "type": "random|story|discovery|threat",
  "choices": [
    {
      "id": "c1",
      "text": "Choice text (imperative, 3-8 words)",
      "consequence": "Brief outcome description (1 sentence).",
      "resourceChanges": { "Fe": 50 },
      "reputationChange": 10
    },
    {
      "id": "c2",
      "text": "Second choice",
      "consequence": "Outcome for choice 2.",
      "resourceChanges": { "credits": -30 }
    },
    {
      "id": "c3",
      "text": "Third choice",
      "consequence": "Outcome for choice 3."
    }
  ]
}

Rules:
- Always provide exactly 3 choices
- resourceChanges keys must be element symbols (H, He, Li, C, O, Fe, Cu, Ag, Au, Pt, U, Pu, Xr7, Nv, Ti, Si) or "credits"
- Resource amounts between -200 and +200, credits between -500 and +500
- reputationChange between -30 and +30 (optional)
- Event type: "threat" if hostile, "discovery" if finding something new, "story" for lore, "random" for anything else
- Scale difficulty and rewards to era level ${era}
- No emojis`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate a narrative event for this civilization:\n\n${context}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      req.log.error({ raw }, "No JSON found in LLM response");
      res.status(500).json({ error: "Failed to parse event" });
      return;
    }

    const event = JSON.parse(jsonMatch[0]);
    res.json(event);
  } catch (err) {
    req.log.error({ err }, "Event generation failed");
    res.status(500).json({ error: "Event generation failed" });
  }
});

export default router;

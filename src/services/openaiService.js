const OpenAI = require("openai");

let client;

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

const SYSTEM_PROMPT = `You are a music curator. The user will describe a mood, activity, or vibe. 
Return a JSON object with exactly this shape — no markdown, no explanation, just raw JSON:

{
  "playlist_name": "short creative playlist title",
  "description": "one-sentence description of the playlist vibe",
  "tracks": [
    { "song": "Song Name", "artist": "Artist Name" }
  ]
}

Rules:
- Return 20 to 30 tracks.
- Choose real, well-known songs that match the prompt.
- Mix popular and slightly deeper cuts for variety.
- The playlist name should be catchy and concise (2-5 words).`;

async function generatePlaylist(userPrompt) {
  const completion = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.9,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = completion.choices[0].message.content;
  return JSON.parse(raw);
}

module.exports = { generatePlaylist };

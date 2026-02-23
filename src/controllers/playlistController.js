const { generatePlaylist } = require("../services/openaiService");
const pool = require("../config/database");

async function getSpotifyToken(userId) {
  const row = await pool.query(
    "SELECT refresh_token FROM spotify_tokens WHERE user_id = $1",
    [userId]
  );
  if (row.rows.length === 0) throw new Error("No Spotify connection");

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: row.rows[0].refresh_token,
    client_id: process.env.SPOTIFY_CLIENT_ID,
    client_secret: process.env.SPOTIFY_CLIENT_SECRET,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || "Token refresh failed");

  if (data.refresh_token) {
    await pool.query(
      "UPDATE spotify_tokens SET refresh_token = $1, updated_at = NOW() WHERE user_id = $2",
      [data.refresh_token, userId]
    );
  }

  return data.access_token;
}

async function generate(req, res, next) {
  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const playlist = await generatePlaylist(prompt.trim());
    res.json(playlist);
  } catch (err) {
    next(err);
  }
}

async function saveToSpotify(req, res, next) {
  try {
    const { name, description, uris } = req.body;
    if (!name || !uris || !uris.length) {
      return res.status(400).json({ error: "name and uris are required" });
    }

    const token = await getSpotifyToken(req.userId);

    const meRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const me = await meRes.json();
    console.log("GET /me status:", meRes.status);

    const createRes = await fetch(
      `https://api.spotify.com/v1/users/${me.id}/playlists`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, description: description || "", public: false }),
      }
    );

    const createBody = await createRes.json();
    console.log("Create playlist status:", createRes.status, JSON.stringify(createBody));

    if (!createRes.ok) {
      return res.status(createRes.status).json({
        error: createBody.error?.message || "Failed to create playlist",
      });
    }

    const playlistId = createBody.id;

    for (let i = 0; i < uris.length; i += 100) {
      const chunk = uris.slice(i, i + 100);
      await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: chunk }),
      });
    }

    res.json({ success: true, playlistId });
  } catch (err) {
    next(err);
  }
}

async function removeFromSpotify(req, res, next) {
  try {
    const { playlistId, uris } = req.body;
    if (!playlistId || !uris || !uris.length) {
      return res.status(400).json({ error: "playlistId and uris are required" });
    }

    const token = await getSpotifyToken(req.userId);

    for (let i = 0; i < uris.length; i += 100) {
      const chunk = uris.slice(i, i + 100);
      const tracks = chunk.map((uri) => ({ uri }));
      await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tracks }),
      });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { generate, saveToSpotify, removeFromSpotify };

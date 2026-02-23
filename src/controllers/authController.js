const appleSignin = require("apple-signin-auth");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");

async function appleAuth(req, res, next) {
  try {
    const { identityToken } = req.body;
    if (!identityToken) {
      return res.status(400).json({ error: "identityToken is required" });
    }

    const claim = await appleSignin.verifyIdToken(identityToken, {
      audience: "com.hakanalsancak.Zapify",
      ignoreExpiration: false,
    });

    const appleUserId = claim.sub;
    const email = claim.email || null;

    const result = await pool.query(
      `INSERT INTO users (apple_user_id, email)
       VALUES ($1, $2)
       ON CONFLICT (apple_user_id) DO UPDATE SET email = COALESCE(EXCLUDED.email, users.email)
       RETURNING id`,
      [appleUserId, email]
    );

    const userId = result.rows[0].id;

    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    const spotifyRow = await pool.query(
      "SELECT id FROM spotify_tokens WHERE user_id = $1",
      [userId]
    );

    res.json({
      token,
      userId,
      isSpotifyConnected: spotifyRow.rows.length > 0,
    });
  } catch (err) {
    next(err);
  }
}

async function spotifyToken(req, res, next) {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: "code is required" });
    }

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET,
    });

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await response.json();
    console.log("Spotify token exchange response:", JSON.stringify({ scope: data.scope, token_type: data.token_type, expires_in: data.expires_in }));

    if (!response.ok) {
      return res.status(400).json({ error: data.error_description || "Spotify token exchange failed" });
    }

    await pool.query(
      `INSERT INTO spotify_tokens (user_id, refresh_token, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET refresh_token = $2, updated_at = NOW()`,
      [req.userId, data.refresh_token]
    );

    res.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      scope: data.scope,
    });
  } catch (err) {
    next(err);
  }
}

async function spotifyRefresh(req, res, next) {
  try {
    const row = await pool.query(
      "SELECT refresh_token FROM spotify_tokens WHERE user_id = $1",
      [req.userId]
    );

    if (row.rows.length === 0) {
      return res.status(404).json({ error: "No Spotify connection found" });
    }

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
    if (!response.ok) {
      return res.status(400).json({ error: data.error_description || "Token refresh failed" });
    }

    if (data.refresh_token) {
      await pool.query(
        "UPDATE spotify_tokens SET refresh_token = $1, updated_at = NOW() WHERE user_id = $2",
        [data.refresh_token, req.userId]
      );
    }

    res.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { appleAuth, spotifyToken, spotifyRefresh };

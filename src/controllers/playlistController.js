const { generatePlaylist } = require("../services/openaiService");

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

module.exports = { generate };

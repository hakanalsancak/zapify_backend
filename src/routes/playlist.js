const { Router } = require("express");
const authenticate = require("../middleware/auth");
const { generate, saveToSpotify, removeFromSpotify } = require("../controllers/playlistController");

const router = Router();

router.post("/generate", authenticate, generate);
router.post("/save", authenticate, saveToSpotify);
router.post("/remove-tracks", authenticate, removeFromSpotify);

module.exports = router;

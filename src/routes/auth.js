const { Router } = require("express");
const authenticate = require("../middleware/auth");
const { appleAuth, spotifyToken, spotifyRefresh } = require("../controllers/authController");

const router = Router();

router.post("/apple", appleAuth);
router.post("/spotify/token", authenticate, spotifyToken);
router.post("/spotify/refresh", authenticate, spotifyRefresh);

module.exports = router;

const { Router } = require("express");
const authenticate = require("../middleware/auth");
const { generate } = require("../controllers/playlistController");

const router = Router();

router.post("/generate", authenticate, generate);

module.exports = router;

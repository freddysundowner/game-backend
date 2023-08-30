const express = require("express");
const settingsRouter = express.Router();
const settings = require("../controllers/settings");

settingsRouter.route(`/`).get(settings.getSettings);
settingsRouter.route(`/`).put(settings.updateSettings);
module.exports = settingsRouter;

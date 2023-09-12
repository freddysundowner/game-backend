const express = require("express");
const referalRouter = express.Router();
const referals = require("../controllers/referals");

referalRouter.route(`/`).get(referals.getUserReferals);
module.exports = referalRouter;

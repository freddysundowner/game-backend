const express = require("express");
const authRouter = express.Router();
const promoController = require("../controllers/promo");


authRouter
    .route(`/`)
    .get(
        promoController.getHighestCrash
    )

module.exports = authRouter; 
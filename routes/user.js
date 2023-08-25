const express = require("express");
const userRouter = express.Router();
const userController = require("../controllers/users");


userRouter
    .route(`/`)
    .get(
        userController.getAllusers
    )

module.exports = userRouter;
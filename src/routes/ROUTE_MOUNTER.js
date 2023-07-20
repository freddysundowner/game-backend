const express = require("express");
const authRouter = require("./authentication");

const passport = require("passport");
module.exports = app = express();

app.use("/", authRouter);

const express = require("express");
const user = require("./user");
const transations = require("./transactions");
const settings = require("./settings");

module.exports = app = express();
app.use("/users", user);
app.use("/dashboardtransactions", transations);
app.use("/settings", settings);

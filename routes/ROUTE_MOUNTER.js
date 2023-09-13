const express = require("express");
const user = require("./user");
const transations = require("./transactions");
const referalaccount = require("./referals");
const auth = require("./auth");
const promos = require("./promos");
const { checkAuthenticated } = require("../shared/functions");

module.exports = app = express();
app.use("/users", user);
app.use("/dashboardtransactions", transations);
app.use("/referalaccount", checkAuthenticated, referalaccount);
app.use("/auth", auth);
app.use("/promos", promos);

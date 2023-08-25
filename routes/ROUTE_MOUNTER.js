const express = require("express");
const user = require("./user");
const transations = require("./transactions");

module.exports = app = express();
app.use("/users", user);
app.use("/transactions", transations);

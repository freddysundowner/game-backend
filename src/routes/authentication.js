const express = require("express");
const authRoute = express.Router();
authRoute.get("/user", checkAuthenticated, async (req, res) => {
  res.send(req.user);
});
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  return res.send("No User Authentication");
}
module.exports = authRoute;

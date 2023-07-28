const mongoose = require("mongoose");
const user = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  referal: {
    type: String,
    default: null
  },
  password: {
    type: String,
    required: true
  },
  balance: {
    type: Number,
    default: 1000
  },
  bonus: {
    type: Number,
    default: 0
  },
  phonenumber: {
    type: String,
    required: true
  },
  bet_amount: {
    type: Number,
    default: 0
  },
  payout_multiplier: {
    type: Number,
    default: 0
  },
  socketid: {
    type: String,
    default: ""
  },

});

module.exports = mongoose.model("User", user);

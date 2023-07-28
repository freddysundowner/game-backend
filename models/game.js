const mongoose = require("mongoose");
const game = new mongoose.Schema({
  round_number: {
    type: Number,
    default: 1,
  },
  active_player_id_list: {
    type: [String],
    default: [],
  },
  multiplier_crash: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    default: "active",
  },
  b_betting_phase: {
    type: Boolean,
    default: false,
  },
  b_game_phase: {
    type: Boolean,
    default: false,
  },
  b_cashout_phase: {
    type: Boolean,
    default: false,
  },
  time_now: {
    type: Number,
    default: -1,
  },
  previous_crashes: {
    type: [Number],
    default: [],
  },
  round_id_list: {
    type: [Number],
    default: [],
  },
});

module.exports = mongoose.model("game", game);

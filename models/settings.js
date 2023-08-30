const mongoose = require("mongoose");
const settings = new mongoose.Schema(
  {
    betlimit: {
      type: Number,
      default: 3000,
    },
    totalamount: {
      type: Number,
      default: 0,
    },
    float: {
      type: Number,
      default: 0,
    },
    safetyMargin: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
    autoCreate: true, // auto create collection
    autoIndex: true, // auto create indexes
  }
);

module.exports = mongoose.model("settings", settings);

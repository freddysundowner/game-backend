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
    floatAmount: {
      type: Number,
      default: 0,
    },
    safetyMargin: {
      type: Number,
      default: 1,
    },
    withdrawcharges: {
      type: Number,
      default: 0,
    },
    withdrawlimit: {
      type: Number,
      default: 100,
    }, 
    referalCommision: {
      type: Number,
      default: 0,
    },
    allowrefer: {
      type: Boolean,
      default: false,
    }, 
    
  },
  {
    timestamps: true,
    autoCreate: true, // auto create collection
    autoIndex: true, // auto create indexes
  }
);

module.exports = mongoose.model("settings", settings);

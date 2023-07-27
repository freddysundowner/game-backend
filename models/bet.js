const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const Bet = new mongoose.Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "user",
        default: null,
    },
    cashout_multiplier: {
        type: Number,
        default: 0
    },
    profit: {
        type: Number,
        default: 0 
    },
    bet_amount: {
        type: Number,
        default: 0
    }
},
    { timestamps: true, autoCreate: true, autoIndex: true });

module.exports = mongoose.model("Bet", Bet);

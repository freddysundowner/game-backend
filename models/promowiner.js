const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const PromoWinners = new mongoose.Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "user",
        default: null,
    },
    transaction: {
        type: Schema.Types.ObjectId,
        ref: "Transaction",
        default: null,
    },
    criteria: {
        type: String,
        default: ""
    },
    amount: {
        type: Number,
        default: 0
    },
    type: {
        type: String,
        default: ''
    },
    status: {
        type: Boolean,
        default: false
    },
    
},
    { timestamps: true, autoCreate: true, autoIndex: true });

module.exports = mongoose.model("promowinner", PromoWinners);

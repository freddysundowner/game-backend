const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const Transaction = new mongoose.Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "user",
        default: null,
    },
    transaction_code: {
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
    description: {
        type: String,
        default: ''
    }
},
    { timestamps: true, autoCreate: true, autoIndex: true });

module.exports = mongoose.model("Transaction", Transaction);

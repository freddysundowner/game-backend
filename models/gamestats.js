const mongoose = require("mongoose");
const gamestats = new mongoose.Schema({
    mined: {
        type: Number,
        required: 0
    },
    gameId: {
        type: String,
        default: null
    },
    totalusers: {
        type: Number,
        default: 0
    },
    taken: {
        type: Number,
        required: true
    },
    crashPoint: {
        type: Number,
        default: 0
    },


},
    {
        timestamps: true,
        autoCreate: true, // auto create collection
        autoIndex: true, // auto create indexes
    });

module.exports = mongoose.model("gamestats", gamestats);

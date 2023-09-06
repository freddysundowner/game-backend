const mongoose = require("mongoose");
const gamestats = new mongoose.Schema({
    mined: {
        type: Number,
        default: 0
    },
    totalusers: {
        type: Number,
        default: 0
    },
    taken: {
        type: Number,
    },
    crashPoint: {
        type: Number,
        default: 0
    },
    totalWins: {
        type: Number,
        default: 0
    },
    taken: {
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

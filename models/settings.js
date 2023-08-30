const mongoose = require("mongoose");
const settings = new mongoose.Schema({
    betlimit: {
        type: Number,
        default: 0
    },
    totalamount: {
        type: Number,
        default: 0
    },
},
    {
        timestamps: true,
        autoCreate: true, // auto create collection
        autoIndex: true, // auto create indexes
    });

module.exports = mongoose.model("settings", settings);

const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const referal = new mongoose.Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "user",
        default: null,
    },
    referal: {
        type: Schema.Types.ObjectId,
        ref: "user",
        default: null,
    },
    void: {
        type: Boolean,
        default: false
    },

},
    {
        timestamps: true,
        autoCreate: true, // auto create collection
        autoIndex: true, // auto create indexes
    });

referal.methods.toJSON = function () {
    const referalObject = this.toObject();
    delete referalObject.__v;
    // Delete any other sensitive fields you want to exclude
    return referalObject;
};

module.exports = mongoose.model("referal", referal);

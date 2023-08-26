const mongoose = require("mongoose");
const user = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  referal: {
    type: String,
    default: null
  },
  avatar: {
    type: String,
    default: 'av-1.png'
  },
  password: {
    type: String,
    required: true
  },
  balance: {
    type: Number,
    default: 0
  },
  bonus: {
    type: Number,
    default: 0
  },
  phonenumber: {
    type: String,
    required: true
  },
  bet_amount: {
    type: Number,
    default: 0
  },
  payout_multiplier: {
    type: Number,
    default: 0
  },
  socketid: {
    type: String,
    default: ""
  },

},
  {
    timestamps: true,
    autoCreate: true, // auto create collection
    autoIndex: true, // auto create indexes
  });

user.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.updatedAt;
  delete userObject.__v;
  // Delete any other sensitive fields you want to exclude
  return userObject;
};

module.exports = mongoose.model("User", user);
 
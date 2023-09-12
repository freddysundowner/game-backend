const mongoose = require("mongoose");
const { Schema, model } = mongoose;
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
  status: {
    type: Boolean,
    default: true
  },
  phonenumber: {
    type: String,
    required: true
  },
  referalEarnings: {
    type: Number,
    default: 0
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
  chatblocked: {
    type: Boolean,
    default: false
  },
  lastbetId: {
    type: Schema.Types.ObjectId,
    ref: "Bet",
    default: null,
  },
  referalCode: {
    type: Number,
    unique: true, // Ensure each number is unique
  },
  referedBy: {
    type: Schema.Types.ObjectId,
    ref: "user",
    default: null,
  },

},
  {
    timestamps: true,
    autoCreate: true, // auto create collection
    autoIndex: true, // auto create indexes
  });

user.pre("save", async function (next) {
  if (!this.referalCode) {
    let referalCode;
    let isUnique = false;

    while (!isUnique) {
      // Generate a random code (you can replace this with your own logic)
      referalCode = Math.floor(Math.random() * 1000000);

      try {
        // Check if the generated code is unique in the database
        const exists = await this.constructor.exists({
          referalCode: referalCode,
        });

        if (!exists) {
          // The code is unique, exit the loop
          isUnique = true;
        }
      } catch (err) {
        return next(err);
      }
    }

    // Set the generated code and continue saving the user
    this.referalCode = referalCode;
  }

  next();
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

const Settings = require("../models/settings");
const Referal = require("../models/referal");
const Transactions = require("../models/Transaction");

exports.getUserReferals = async (req, res) => {
  try {
    let settingsReponse = await Settings.findById(process.env.SETTINGS_ID);
    let referals = await Referal.find({ "user": req.user._id }).populate({
      path: 'referal',
      model: 'User',
      select: 'username _id createdAt updatedAt'
    });
    const transactions = await Transactions.find({ "user": req.user._id, type: 'referals' }).populate({
      path: 'refered',
      model: 'User',
      select: 'username _id createdAt updatedAt'
    });
    res.json({
      referalCommision: settingsReponse.referalCommision,
      referals,
      transactions: transactions,

    });
  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    console.log(req.body)
    if (!req.body || Object.keys(req.body).length == 0) {
      return res.status(500).send({
        message: "nothing to update",
      });
    }
    let response = await Settings.findByIdAndUpdate(
      process.env.SETTINGS_ID,
      {
        $set: req.body,
      },
      {
        upsert: true,
        returnOriginal: false,
      }
    );
    res.json(response);
  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
};

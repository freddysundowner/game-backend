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
    console.log(referals);
    const earnings = await Referal.aggregate([
      {
        $match: {
          user: req.user._id,
        },
      },
      {
        $group: {
          _id: null,
          earnings: { $sum: "$earnings" },
          count: {
            $sum: 1,
          },
        },
      },
    ]);
    const transactions = await Transactions.aggregate([
      {
        $match: {
          user: req.user._id,
          type: 'referals',
        },
      },
    ]);
    res.json({
      referalCommision: settingsReponse.referalCommision,
      referals,
      earnings: earnings.length > 0 ? earnings[0]['earnings'] : 0,
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

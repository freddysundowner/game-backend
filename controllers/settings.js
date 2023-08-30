const Settings = require("../models/settings");

exports.getSettings = async (req, res) => {
  try {
    let response = await Settings.findById(process.env.SETTINGS_ID);
    res.json(response);
  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
};

exports.updateSettings = async (req, res) => {
  try {
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

const mongoose = require("mongoose");
const options = require("../config/mongooseOptions");

require("dotenv").config({ path: ".env" });
const connect = () => {
  mongoose
    .connect(process.env.MONGOOSE_DB_LINK, options)
    .then(
      (res) => {
        console.log(`connected!`);
      },
      (err) => console.log(err)
    )
    .catch((err) => console.log(err));
};

module.exports = connect;

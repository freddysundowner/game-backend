const mongoose = require("mongoose");
const express = require("express");
const passport = require("passport");
const http = require("http");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");
const MongoDBStore = require("connect-mongodb-session")(session);
const Axios = require("axios");

const app = express();
const server = http.createServer(app);

const functions = require("./shared/functions");
require("dotenv").config();

// Connect to MongoDB
const connect = function () {
  mongoose.connect(
    process.env.MONGOOSE_DB_LINK,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    },
    (err) => {
      if (err) {
        setTimeout(connect, 5000);
      }
    }
  );
};
connect();

const Bet = require("./models/bet");
const GameStats = require("./models/gamestats");
const Transaction = require("./models/Transaction");
const User = require("./models/user");
const Game = require("./models/game");
const Settings = require("./models/settings");

let gameId;
let live_bettors_table = [];
let betting_phase = false;
let game_phase = false;
let cashout_phase = true;
let game_crash_value = -69;
let sent_cashout = true;
let connections = [];

let availableResources = 0;
let safetyMargin = 0;
let betLimit = 0;

var ObjectId = require("mongodb").ObjectId;
const GAME_LOOP_ID = process.env.GAME_LOOP_ID;

//server setup
const io = require("socket.io")(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true,
  }, //
});
server.listen(process.env.PORT, function (err) {
  if (err) {
    throw err;
  }
  console.log("server listening on: ", ":", process.env.PORT);
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(require("./routes/ROUTE_MOUNTER"));
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
const store = new MongoDBStore({
  uri: process.env.MONGOOSE_DB_LINK,
  expires: 1000 * 60 * 60,
});

app.use(
  session({
    secret: process.env.PASSPORT_SECRET,
    store: store,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(cookieParser(process.env.PASSPORT_SECRET));
app.use(passport.initialize());
app.use(passport.session());
require("./passportConfig")(passport);

app.get("/", async (req, res) => {
  res.send({ default: "none" });
});
// const socketModule = require("./socketModule"); // Path to your socketModule.js file

// socketModule(io, Game, Bet, User);

io.on("connection", async (socket) => {
  connections.push(socket.id);
  io.emit("newconection", connections);
  socket.emit("myconection", socket.id);

  socket.on("get_game_status", async (data) => {
    let theLoop = await Game.findById(GAME_LOOP_ID);
    // if (theLoop == null) {
    //   Game.create({})
    // }

    socket.emit("crash_history", theLoop.previous_crashes);
    var status;
    if (betting_phase == true) {
      status = { phase: "betting_phase", info: phase_start_time };
    } else if (game_phase == true) {
      status = { phase: "game_phase", info: phase_start_time };
    }
    socket.emit("get_game_status", status);
  });

  //disconnect from socket
  socket.on("disconnect", async () => {
    const index = connections.indexOf(socket.id);
    if (index > -1) {
      connections.splice(index, 1);
    }
    io.emit("newconection", connections);
  });
  theLoop = await Game.findById(GAME_LOOP_ID);
  socket.on("bet", async (data) => {
    var bet_amount = data.bet_amount;
    var payout_multiplier = data.payout_multiplier;
    gameId = data.gameId;
    var userid = data.userid;
    if (!betting_phase) {
      console.log({ customError: "IT IS NOT THE BETTING PHASE" });
      return;
    }
    if (isNaN(bet_amount) == true || isNaN(payout_multiplier) == true) {
      console.log({ customError: "Not a number" });
      return;
    }
    bDuplicate = false;
    for (var i = 0; i < live_bettors_table.length; i++) {
      if (live_bettors_table[i].the_user_id === userid) {
        console.log({ customError: "You are already betting this round" });
        bDuplicate = true;
        break;
      }
    }
    if (bDuplicate) {
      return;
    }
    thisUser = await User.findById(userid);
    if (!thisUser) {
      console.log("ERROR BETTING");
      return;
    }
    if (bet_amount > thisUser.balance) {
      console.log("NO ENOUGH MONEY IN THE WALLET");
      socket.emit("success_betting", {
        status: false,
        message: "NO ENOUGH MONEY IN THE WALLET",
      });
      return;
    }
    thisUser.balance = thisUser.balance - bet_amount;
    const betId = new ObjectId();
    thisUser.bet_amount = bet_amount;
    thisUser.payout_multiplier = payout_multiplier;
    info_json = {
      the_user_id: userid,
      the_username: thisUser.username,
      bet_amount: bet_amount,
      userdata: thisUser,
      cashout_multiplier: null,
      profit: null,
      b_bet_live: true,
      payout_multiplier,
      balance: thisUser.balance,
      betId,
    };
    live_bettors_table.push(info_json);
    io.emit("receive_live_betting_table", JSON.stringify(live_bettors_table));
    socket.emit("success_betting", {
      status: true,
      message: "",
      data: info_json,
    });

    await User.findByIdAndUpdate(userid, {
      bet_amount: bet_amount,
      payout_multiplier: payout_multiplier,
    });
    await User.findByIdAndUpdate(userid, {
      balance: thisUser.balance,
    });
    await Game.findByIdAndUpdate(GAME_LOOP_ID, {
      $push: { active_player_id_list: userid },
    });

    const bet = new Bet({
      cashout_multiplier: payout_multiplier,
      user: userid,
      bet_amount: bet_amount,
      _id: betId,
    });
    await bet.save();
  });

  socket.on("receive_my_bets_table", async (data) => {
    let bets = await Bet.find({ user: data.id }).sort({ createdAt: -1 });
    socket.emit("receive_my_bets_table", JSON.stringify(bets));
  });

  socket.on("auto_cashout_early", async (data) => {
    var userid = data.userid;
    var payout_multiplier = data.payout_multiplier;
    if (!game_phase) {
      return;
    }
    cashOutNow(userid, "auto", payout_multiplier);
  });

  const cashOutNow = async (userid, type = "", payout_multiplier) => {
    let time_elapsed = (Date.now() - phase_start_time) / 1000.0;
    let current_multiplier =
      type == "auto"
        ? payout_multiplier
        : (1.0024 * Math.pow(1.0718, time_elapsed)).toFixed(2);
    if (current_multiplier <= game_crash_value) {
      for (const bettorObject of live_bettors_table) {
        if (bettorObject.the_user_id === userid) {
          bettorObject.cashout_multiplier = current_multiplier;
          bettorObject.profit =
            bettorObject.bet_amount * current_multiplier -
            bettorObject.bet_amount;
          bettorObject.b_bet_live = false;
          bettorObject.userdata.balance +=
            bettorObject.userdata.bet_amount * current_multiplier;
          let sendData = {
            amount:
              bettorObject.bet_amount * current_multiplier -
              bettorObject.bet_amount,
            user: bettorObject.userdata,
          };
          if (type == "manual") {
            socket.emit("manual_cashout_early", sendData);
          }
          if (type == "auto") {
            socket.emit("auto_cashout_early", sendData);
          }
          io.emit(
            "receive_live_betting_table",
            JSON.stringify(live_bettors_table)
          );
          const currUser = await User.findById(userid);
          currUser.balance = bettorObject.userdata.balance;
          await currUser.save();
          await theLoop.updateOne({
            $pull: { active_player_id_list: userid },
          });
          await Bet.findByIdAndUpdate(bettorObject.betId, {
            cashout_multiplier: current_multiplier,
            profit: bettorObject.profit,
          });

          let taken = (bettorObject.bet_amount * current_multiplier).toFixed(2);
          let totalWins = (
            bettorObject.bet_amount * current_multiplier -
            bettorObject.bet_amount
          ).toFixed(2);
          createGameStats(taken, totalWins, 0, 1);
          break;
        }
      }
    }
  };
  socket.on("manual_cashout_early", async (data) => {
    var userid = data.userid;
    if (!game_phase) {
      return;
    }
    cashOutNow(userid, "manual");
  });
});

const createGameStats = async (
  taken = 0,
  totalWins = 0,
  mined = 0,
  totalusers = 0
) => {
  let gamestats = await GameStats.findOneAndUpdate(
    { _id: gameId },
    {
      $inc: {
        taken,
        totalWins,
        mined,
        totalusers,
      },
    },
    {
      upsert: true,
      returnOriginal: false,
    }
  );
  if (mined > 0 || taken > 0) {
    // let id = await Settings.create({});
    await Settings.findOneAndUpdate(
      { _id: process.env.SETTINGS_ID },
      {
        $inc: {
          totalamount: mined,
          float: -taken,
        },
      },
      {
        upsert: true,
        returnOriginal: false,
      }
    );
  }
};

app.post("/login", (req, res, next) => {
  let phonewithplus = functions.validateKenyanPhoneNumber(req.body.phonenumber);
  if (phonewithplus === null) {
    res.json({ status: 400, message: "Phone number is invalid" });
    return;
  }
  req.body.phonenumber = functions.getPhoneNumberWithoutPlus(phonewithplus);
  passport.authenticate("local", async (err, user, info) => {
    if (err) throw err;
    if (!user) {
      res.json({ status: 400, message: "Username or Password is Wrong" });
    } else {
      let existingSessions = await mongoose.connection.db
        .collection("sessions")
        .find({
          "session.passport.user": user._id.toString(),
          _id: {
            $ne: req.session._id,
          },
        })
        .toArray();

      if (existingSessions.length) {
        await mongoose.connection.db.collection("sessions").deleteMany({
          _id: {
            $in: existingSessions.map(({ _id }) => _id),
          },
        });
      }
      req.logIn(user, async (err) => {
        if (err) throw err;
        io.to(user.socketid).emit("update_user");

        await User.findByIdAndUpdate(user._id, {
          socketid: req.body.socketid,
        });

        res.json({ status: 200, message: "Logged in successfully" });
      });
    }
  })(req, res, next);
});

app.post("/changepassword", checkAuthenticated, async (req, res) => {
  const { newPassword, confirmNewPassword } = req.body;
  const currentPassword = req.user.password;
  //Check required fields
  if (!currentPassword || !newPassword || !confirmNewPassword) {
    res.json({ msg: "Please fill in all fields.", status: false });
    return;
  }

  //Check passwords match
  if (newPassword !== confirmNewPassword) {
    res.json({ msg: "New passwords do not match.", status: false });
    return;
  }

  //Check password length
  if (newPassword.length < 6 || confirmNewPassword.length < 6) {
    res.json({
      msg: "Password should be at least six characters.",
      status: false,
    });
    return;
  }

  User.findOne({ _id: req.user._id }).then(async (user) => {
    //Update password for user with new password
    bcrypt.genSalt(10, (err, salt) =>
      bcrypt.hash(newPassword, salt, (err, hash) => {
        if (err) throw err;
        user.password = hash;
        user.save();
      })
    );
    res.json({ msg: "Password changed successfully", status: true });
  });
});

app.post("/sendotp", async (req, res) => {
  let phonenumber = functions.validateKenyanPhoneNumber(req.body.phonenumber);
  let phonenumberwithoutplus = functions.getPhoneNumberWithoutPlus(phonenumber);
  if (phonenumber === null) {
    res.json({
      status: 400,
      message: "invalid phone number",
    });
    return;
  }
  let user = await User.findOne({ phonenumber: phonenumberwithoutplus });
  if (user) {
    let response = await functions.sendSms(phonenumberwithoutplus);
    if (response.status === 200) {
      const otpExpiry = Date.now() + 5 * 60 * 1000; // OTP expiry set to 5 minutes from now

      req.session.otp = { code: response.code, expiry: otpExpiry };
      req.session.phonenumber = phonenumber;
      res.json({
        status: response.status,
        message: "Enter OTP code send to " + phonenumberwithoutplus,
      });
    } else {
      res.json({
        status: response.status,
        message: "Error sending otp code to " + phonenumberwithoutplus,
      });
    }
  } else {
    res.json({
      status: 400,
      message:
        "You do not have an account with this number " + phonenumberwithoutplus,
    });
  }
});
app.post("/resetpassword", async (req, res) => {
  const password = req.body.password;
  const confirmpassword = req.body.confirmpassword;
  if (password !== confirmpassword) {
    return res.json({ message: "password must match", status: 400 });
  }
  if (password === confirmpassword) {
    const hashedPassword = await bcrypt.hash(password, 10);
    let user = await User.findOneAndUpdate(
      {
        phonenumber: functions.getPhoneNumberWithoutPlus(
          req.session.phonenumber
        ),
      },
      { $set: { password: hashedPassword } }
    );
    if (user) {
      return res.json({ message: "passsord reset successfully", status: 200 });
    } else {
      return res.json({ message: "passsord reset failed", status: 400 });
    }
  }
});
app.post("/verifyotp", async (req, res) => {
  const userOTP = req.body.otp;
  const sessionOTP = req.session.otp;
  if (!sessionOTP || sessionOTP.expiry < Date.now()) {
    return res.json({ message: "OTP expired or not generated", status: 400 });
  }
  if (parseInt(userOTP) === sessionOTP.code) {
    delete req.session.otp; // Remove OTP from session after successful verification
    return res.json({ message: "OTP verified successfully", status: 200 });
  } else {
    return res.json({ message: "Incorrect OTP", status: 400 });
  }
});
app.post("/register", (req, res) => {
  if (req.body.password < 3) {
    res.json({
      status: 400,
      message: "Password must be more than 3 characters",
    });
    return;
  }
  if (req.body.username.length < 3) {
    res.json({
      status: 400,
      message: "Username must be more than 3 characters",
    });
    return;
  }
  if (req.body.phonenumber == "") {
    res.json({ status: 400, message: "Phone number is required" });
    return;
  }
  let phonewithplus = functions.validateKenyanPhoneNumber(req.body.phonenumber);
  if (phonewithplus === null) {
    res.json({ status: 400, message: "Phone number is invalid" });
    return;
  }
  let phone = functions.getPhoneNumberWithoutPlus(phonewithplus);
  var username = req.body.username;
  var referal = req.body.referal;

  User.findOne({ phonenumber: phone }, async (err, doc) => {
    if (err) throw err;
    if (doc) res.json({ status: 400, message: "Phone number already exists" });
    if (!doc) {
      const hashedPassword = await bcrypt.hash(req.body.password, 10);

      const newUser = new User({
        username: username,
        password: hashedPassword,
        phonenumber: phone,
      });
      await newUser.save();

      /*
            if (referal) {
              console.log(referal)
              var userId = Buffer.from(referal, 'base64').toString()
              console.log(userId)
      
              await User.findByIdAndUpdate(userId, { $inc: { bonus: 1 } });
            }
      */

      res.json({ status: 200, message: "Registered in successfully" });
    }
  });
});
// Routes
app.get("/user", checkAuthenticated, async (req, res) => {
  res.send(req.user);
});

app.post("/user/update", checkAuthenticated, async (req, res) => {
  const response = await User.findOneAndUpdate(
    { _id: req.user._id },
    req.body,
    { new: true }
  );
  res.send(response);
});
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  return res.send("No User Authentication");
}

app.get("/logout", (req, res) => {
  req.logout();
  res.send("success2");
});

app.get("/retrieve_active_bettors_list", async (req, res) => {
  io.emit("receive_live_betting_table", JSON.stringify(live_bettors_table));
  res.json(live_bettors_table);
});
app.post("/depositaccount", checkAuthenticated, async (req, res) => {
  var data = {
    amount: req.body.amount,
    total_amount: req.body.amount,
    phone: req.user.phonenumber,
    id: req.user._id,
    socketid: req.body.socketid,
    call_back: process.env.MPESA_DEPOSIT_CALLBACK,
  };
  Axios({
    method: "POST",
    data: data,
    withCredentials: true,
    url: process.env.MPESA_DEPOSIT_URL,
  }).then(async (ress) => {
    const currUser = await User.findOne({ _id: req.user._id });
    currUser.socketid = req.body.socketid;
    currUser.save();
    res.json(ress.data);
    if (ress.data !== 200) {
      return;
    }
  });
});

app.post("/verify_mpesa_code", checkAuthenticated, async (req, res) => {
  var data = {
    code: req.body.code,
    call_back: process.env.VERIFY_MPESA_CODE_CALLBACK,
    socketId: req.body.socketid,
  };
  Axios({
    method: "POST",
    data: data,
    withCredentials: true,
    url: process.env.MPESA_QUERY,
  }).then(async (ress) => {
    return res.json(ress.data);
  });
});

app.post("/verify_code", async (req, res) => {
  var query = JSON.parse(req.query.payload);
  if (req.body["Result"]["ResultParameters"] === undefined) {
    io.to(query.socketId).emit("code_verified", {
      status: 500,
      message: "invalid mpesa code, please correct and try again",
    });
    res.json({ status: 500, message: "error" });
    return;
  }
  var phone, amount, transcode;
  req.body["Result"]["ResultParameters"]["ResultParameter"].forEach((e, r) => {
    if (e["Key"] == "DebitPartyName") {
      phone = e["Value"].split(" ")[0];
    }
    if (e["Key"] == "ReceiptNo") {
      transcode = e["Value"];
    }
    if (e["Key"] == "Amount") {
      amount = e["Value"];
    }
  });
  if (transcode == null || transcode == "" || phone == null || phone == "") {
    io.to(query.socketId).emit("code_verified", {
      status: 500,
      message: "technical error happened",
    });
    res.json({ status: 500, message: "error" });
    return;
  }
  const transactions = await Transaction.find({
    transaction_code: transcode,
  });

  if (transactions.length > 0) {
    io.to(query.socketId).emit("code_verified", {
      status: 500,
      message: "Transaction code has been used already",
    });
    res.json({ status: 500, message: "dublicate" });
  } else {
    const currUser = await User.findOne({ phonenumber: phone });
    currUser.balance += amount;
    currUser.save();

    const transaction = new Transaction({
      amount: amount,
      user: currUser._id,
      transaction_code: transcode,
      type: "deposit",
      status: true,
    });
    await transaction.save();

    io.to(query.socketId).emit("code_verified", {
      status: 200,
      message: "successfully deposited",
      user: currUser,
    });
    res.json({
      status: 200,
      message: "success fully deposited",
      user: currUser,
    });
  }
});

app.post("/withdraw/response", async (req, res) => {
  console.log(req.body);
  const transactionRes = await Transaction.findOne({
    _id: req.body.transactionId,
  });
  console.log(transactionRes);
  transactionRes.status = req.body.ResultCode == 0;
  transactionRes.transaction_code = req.body.TransID;
  transactionRes.description =
    req.body.ResultCode == 1 ? req.body.mpesamessage : "";
  transactionRes.save();
  console.log(transactionRes);
});

app.post("/withdraw", checkAuthenticated, async (req, res) => {
  let amount = parseInt(req.body.amount);
  //get withdraw charges
  let charges = 0;
  let gameSettings = await Settings.findById(process.env.SETTINGS_ID);
  if (gameSettings) {
    charges = amount > 1000 ? 23 : parseInt(gameSettings.withdrawcharges);

  }
  let AmountWithCharges = amount + charges;
  console.log(AmountWithCharges)
  console.log(amount)

  if (amount > req.user.balance) {
    res.json({
      status: 400,
      message:
        "you have insufficient balance to withdraw KES " + amount,
    });
  } else {

    if (amount < gameSettings.withdrawlimit) {
      res.json({
        status: 400,
        message:
          "you cannot withdraw less than KES " + gameSettings.withdrawlimit,
      });
      return;
    }
    let actualAmount = amount - charges;

    const transaction = new Transaction({
      amount: actualAmount,
      user: req.user._id,
      type: "withdraw",
      status: false,
      charges
    });
    transaction.save();

    Axios({
      method: "POST",
      data: {
        amount: actualAmount,
        phone: req.user.phonenumber,
        transactionId: transaction._id,
      },
      withCredentials: true,
      url: process.env.MPESA_WITHDRAW_URL,
    }).then(async (ress) => {
      if (ress.data.status == 200) {
        const currUser = await User.findOne({ _id: req.user._id });
        currUser.balance = currUser.balance - AmountWithCharges;
        currUser.save();
      }
      res.json(ress.data);
    });
  }
});
app.post("/deposit", async (req, res) => {
  var transaction_code = req.body.transactionid;
  const transactions = await Transaction.find({
    transaction_code: transaction_code,
  });
  if (transactions.length > 0) {
    res.json({ status: 500, message: "dublicate" });
  } else {
    var amount = parseInt(req.body.amount);
    var phone = req.body.phone;
    const currUser = await User.findOne({ phonenumber: phone });

    if (!currUser) {
      return;
    }
    var socketid = currUser.socketid;
    currUser.balance += amount;
    io.to(socketid).emit("deposit_success", { user: currUser, amount });
    currUser.save();

    const transaction = new Transaction({
      amount: amount,
      user: currUser._id,
      transaction_code: transaction_code,
      type: "deposit",
      status: true,
    });
    await transaction.save();
    res.json(currUser);
  }
});

app.get("/transactions", async (req, res, next) => {
  var transactions = await Transaction.find({ user: req.user._id }).sort({
    createdAt: -1,
  });
  res.json(transactions);
});

const cashout = async () => {
  theLoop = await Game.findById(GAME_LOOP_ID);
  playerIdList = theLoop.active_player_id_list;
  crash_number = game_crash_value;
  let totalBetMined = 0;
  let taken = 0;
  let totalWins = 0;
  for (const bettorObject of live_bettors_table) {
    const currUser = await User.findById(bettorObject.the_user_id);
    if (
      currUser.payout_multiplier > 0 &&
      currUser.payout_multiplier <= crash_number
    ) {
      currUser.balance += currUser.bet_amount * currUser.payout_multiplier;
      taken += currUser.bet_amount * currUser.payout_multiplier;
      totalWins +=
        currUser.bet_amount * currUser.payout_multiplier - currUser.bet_amount;
      await currUser.save();
    } else {
      totalBetMined += currUser.bet_amount;
    }
  }
  if (playerIdList.length > 0) {
    createGameStats(taken, totalWins, totalBetMined, playerIdList.length);
  }
  if (playerIdList.length == 0) {
    await GameStats.findByIdAndDelete(gameId);
  }
  gameId = null;
  //create game if it does not exists
  if (gameId == null) {
    let game = await GameStats.create({
      totalusers: 0,
    });
    gameId = game._id;
  }
  theLoop.active_player_id_list = [];
  live_bettors_table = [];
  await theLoop.save();
};

// Run Game Loop
let phase_start_time = Date.now();
setInterval(async () => {
  await loopUpdate();
}, 1000);

// Game Loop
const loopUpdate = async () => {
  let time_elapsed = (Date.now() - phase_start_time) / 1000.0;
  if (betting_phase) {
    if (time_elapsed > 10) {
      sent_cashout = false;
      betting_phase = false;
      game_phase = true;
      if (live_bettors_table.length > 0) {
        game_crash_value = generateCrashValue(live_bettors_table);
      }
      io.emit("start_multiplier_count", gameId);
      phase_start_time = Date.now();
    }
  } else if (game_phase) {
    current_multiplier = (1.0024 * Math.pow(1.0718, time_elapsed)).toFixed(2);
    if (current_multiplier > game_crash_value) {
      io.emit("stop_multiplier_count", game_crash_value.toFixed(2));
      game_phase = false;
      cashout_phase = true;
      phase_start_time = Date.now();
    }
  } else if (cashout_phase) {
    if (!sent_cashout) {
      cashout();
      sent_cashout = true;
      right_now = Date.now();
      const update_loop = await Game.findById(GAME_LOOP_ID);
      await update_loop.updateOne({
        $push: {
          previous_crashes: {
            $each: [game_crash_value],
            $slice: 25,
            $position: 0,
          },
        },
      });
      await update_loop.updateOne({ $pull: { previous_crashes: null } });
    }

    if (time_elapsed > 3) {
      cashout_phase = false;
      betting_phase = true;

      //set game params;
      let gameSettings = await Settings.findById(process.env.SETTINGS_ID);
      if (gameSettings) {
        availableResources = gameSettings.float;
        safetyMargin = gameSettings.safetyMargin;
        betLimit = gameSettings.betlimit;
      }

      let randomInt = Math.floor(Math.random() * (9999999999 - 0 + 1) + 0);
      if (randomInt % 33 == 0) {
        game_crash_value = 1;
      } else {
        random_int_0_to_1 = Math.random();
        while (random_int_0_to_1 == 0) {
          random_int_0_to_1 = Math.random();
        }
        game_crash_value = 0.01 + 0.99 / random_int_0_to_1;
        game_crash_value = Math.round(game_crash_value * 100) / 100;
      }

      io.emit("update_user");
      io.emit("start_betting_phase");
      io.emit("testingvariable");
      let theLoop = await Game.findById(GAME_LOOP_ID);
      io.emit("crash_history", theLoop.previous_crashes);
      live_bettors_table = [];
      phase_start_time = Date.now();
    }
  }
};

function generateCrashValue(live_bettors_table) {
  const total = live_bettors_table.reduce(
    (acc, obj) => acc + obj.bet_amount,
    0
  );

  const randomInt = Math.floor(Math.random() * (9999999999 - 0 + 1) + 0);
  if (randomInt % 33 === 0) {
    return 1;
  } else {
    const totalBets = live_bettors_table.length * total;
    const maxAllowedCrashValue =
      (availableResources - safetyMargin) / totalBets;
    const random_int_0_to_1 = Math.random();
    const adjustedCrashValue = Math.min(
      maxAllowedCrashValue,
      1.1 + 0.9 / random_int_0_to_1
    );
    return Math.round(adjustedCrashValue * 100) / 100;
  }
}

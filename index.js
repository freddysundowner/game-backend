const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");
const express = require("express");
const passport = require("passport");
const http = require("http");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");
const GAME_LOOP_ID = "64b90ebbb2cc7b24e1854c58";

const Bet = require("./models/bet");
const Transaction = require("./models/Transaction");

require("dotenv").config();
const app = express();
const server = http.createServer(app);

const User = require("./models/user");
const Game_loop = require("./models/game_loop");
const Axios = require("axios");
require("dotenv").config();
var ObjectId = require("mongodb").ObjectId;
// Connect to MongoDB
mongoose.connect(process.env.MONGOOSE_DB_LINK, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: true,
});
var url = "https://wiggolive.com";

const io = require("socket.io")(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true,
  }, //
});
// tell the application to listen on the port specified
server.listen(process.env.PORT, function (err) {
  if (err) {
    throw err;
  }
  console.log("server listening on: ", ":", process.env.PORT);
});

// Backend Setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(
  session({
    secret: process.env.PASSPORT_SECRET,
    resave: true,
    saveUninitialized: true,
  })
);
app.use(cookieParser(process.env.PASSPORT_SECRET));
app.use(passport.initialize());
app.use(passport.session());
require("./passportConfig")(passport);

app.get("/", async (req, res) => {
  res.send({ default: "none" });
});

const messages_list = [];
let live_bettors_table = [];
let betting_phase = false;
let game_phase = false;
let cashout_phase = true;
let game_crash_value = -69;
let sent_cashout = true;
let active_player_id_list = [];
let connections = [];

io.on("connection", async (socket) => {
  connections.push(socket.id);

  //send connection state to all users
  io.emit("newconection", connections);

  //send connection state to specific socket
  socket.emit("myconection", socket.id);
  //disconnect from socket
  socket.on("disconnect", async () => {
    const index = connections.indexOf(socket.id);
    if (index > -1) {
      connections.splice(index, 1);
    }
    io.emit("newconection", connections);
  });

  theLoop = await Game_loop.findById(GAME_LOOP_ID);
  // console.log(theLoop);
  socket.on("bet", async (data) => {
    var bet_amount = data.bet_amount;
    var payout_multiplier = data.payout_multiplier;
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
      return;
    }
    thisUser.balance = thisUser.balance - bet_amount;
    const betId = new ObjectId();

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
    socket.emit("success_betting", info_json);

    await User.findByIdAndUpdate(userid, {
      bet_amount: bet_amount,
      payout_multiplier: payout_multiplier,
    });
    await User.findByIdAndUpdate(userid, {
      balance: thisUser.balance,
    });
    await Game_loop.findByIdAndUpdate(GAME_LOOP_ID, {
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
  socket.on("get_game_status", async (data) => {
    console.log("get game ststus");
    let theLoop = await Game_loop.findById(GAME_LOOP_ID);
    socket.emit("crash_history", theLoop.previous_crashes);
    //     io.emit("get_round_id_list", theLoop.round_id_list);
    var status;
    if (betting_phase == true) {
      status = { phase: "betting_phase", info: phase_start_time };
    } else if (game_phase == true) {
      status = { phase: "game_phase", info: phase_start_time };
    }
    socket.emit("get_game_status", status);
  });

  socket.on("auto_cashout_early", async (data) => {
    console.log("auto_cashout_early", data);
    var userid = data.userid;
    var payout_multiplier = data.payout_multiplier;
    if (!game_phase) {
      return;
    }
    let time_elapsed = (Date.now() - phase_start_time) / 1000.0;
    current_multiplier = (1.0024 * Math.pow(1.0718, time_elapsed)).toFixed(2);
    if (payout_multiplier <= game_crash_value) {
      for (const bettorObject of live_bettors_table) {
        if (bettorObject.the_user_id === userid) {
          bettorObject.cashout_multiplier = bettorObject.payout_multiplier;
          bettorObject.profit =
            bettorObject.bet_amount * current_multiplier -
            bettorObject.bet_amount;
          bettorObject.b_bet_live = false;
          bettorObject.userdata.balance +=
            bettorObject.bet_amount * current_multiplier;
          io.emit(
            "receive_live_betting_table",
            JSON.stringify(live_bettors_table)
          );

          socket.emit("auto_cashout_early", bettorObject);
          const currUser = await User.findById(userid);
          currUser.balance +=
            bettorObject.bet_amount * bettorObject.payout_multiplier;
          await currUser.save();

          await Bet.findByIdAndUpdate(bettorObject.betId, {
            cashout_multiplier: bettorObject.cashout_multiplier,
            profit: bettorObject.profit,
          });

          break;
        }
      }
    }
  });
  socket.on("manual_cashout_early", async (data) => {
    var userid = data.userid;
    if (!game_phase) {
      return;
    }
    // console.log("theLoop", theLoop);
    let time_elapsed = (Date.now() - phase_start_time) / 1000.0;
    current_multiplier = (1.0024 * Math.pow(1.0718, time_elapsed)).toFixed(2);
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
          socket.emit("manual_cashout_early", {
            user: bettorObject.userdata,
            amount: bettorObject.bet_amount * current_multiplier,
          });
          io.emit(
            "receive_live_betting_table",
            JSON.stringify(live_bettors_table)
          );
          const currUser = await User.findById(userid);
          currUser.balance = bettorObject.userdata.balance;
          await currUser.save();
          // active_player_id_list.
          await theLoop.updateOne({
            $pull: { active_player_id_list: userid },
          });

          await Bet.findByIdAndUpdate(bettorObject.betId, {
            cashout_multiplier: bettorObject.cashout_multiplier,
            profit: bettorObject.profit,
          });

          break;
        }
      }
    }
  });
});

//Passport.js login/register system
app.post("/login", (req, res, next) => {
  console.log(req.body);
  passport.authenticate("local", (err, user, info) => {
    if (err) throw err;
    if (!user) {
      res.json({ status: 400, message: "Username or Password is Wrong" });
    } else {
      req.logIn(user, (err) => {
        if (err) throw err;
        res.json({ status: 200, message: "Logged in successfully" });
      });
    }
  })(req, res, next);
});

app.post("/register", (req, res) => {
  console.log(req.body);
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

  var phone = req.body.phonenumber;
  var username = req.body.username;

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
      res.json({ status: 200, message: "Registered in successfully" });
    }
  });
});
// Routes
// app.get("/user", async (req, res) => {
app.get("/user", checkAuthenticated, async (req, res) => {
  res.send(req.user);
});
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  return res.send("No User Authentication");
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  next();
}

app.get("/logout", (req, res) => {
  req.logout();
  res.send("success2");
});

app.get("/multiply", checkAuthenticated, async (req, res) => {
  const thisUser = await User.findById(req.user._id);
  const game_loop = await Game_loop.findById(GAME_LOOP_ID);
  crashMultipler = game_loop.multiplier_crash;
  thisUser.balance = thisUser.balance + crashMultipler;
  await thisUser.save();
  res.json(thisUser);
});

app.get("/generate_crash_value", async (req, res) => {
  console.log("generate_crash_value");
  const randomInt = Math.floor(Math.random() * 6) + 1;
  const game_loop = await Game_loop.findById(GAME_LOOP_ID);
  game_loop.multiplier_crash = randomInt;
  await game_loop.save();
  res.json(randomInt);
});

app.get("/retrieve", async (req, res) => {
  const game_loop = await Game_loop.findById(GAME_LOOP_ID);
  crashMultipler = game_loop.multiplier_crash;
  res.json(crashMultipler);
  const delta = sw.read(2);
  let seconds = delta / 1000.0;
  seconds = seconds.toFixed(2);
  return;
});

app.post("/send_bet", checkAuthenticated, async (req, res) => {
  if (!betting_phase) {
    res.status(400).json({ customError: "IT IS NOT THE BETTING PHASE" });
    return;
  }
  if (
    isNaN(req.body.bet_amount) == true ||
    isNaN(req.body.payout_multiplier) == true
  ) {
    res.status(400).json({ customError: "Not a number" });
  }
  bDuplicate = false;
  theLoop = await Game_loop.findById(GAME_LOOP_ID);
  playerIdList = theLoop.active_player_id_list;
  let now = Date.now();
  for (var i = 0; i < playerIdList.length; i++) {
    if (playerIdList[i] === req.user.id) {
      res
        .status(400)
        .json({ customError: "You are already betting this round" });
      bDuplicate = true;
      break;
    }
  }
  if (bDuplicate) {
    return;
  }
  thisUser = await User.findById(req.user.id);
  if (req.body.bet_amount > thisUser.balance) {
    res.status(400).json({ customError: "Bet too big" });
    return;
  }
  await User.findByIdAndUpdate(req.user.id, {
    bet_amount: req.body.bet_amount,
    payout_multiplier: req.body.payout_multiplier,
  });
  await User.findByIdAndUpdate(req.user.id, {
    balance: thisUser.balance - req.body.bet_amount,
  });
  await Game_loop.findByIdAndUpdate(GAME_LOOP_ID, {
    $push: { active_player_id_list: req.user.id },
  });

  info_json = {
    the_user_id: req.user.id,
    the_username: req.user.username,
    bet_amount: req.body.bet_amount,
    cashout_multiplier: null,
    profit: null,
    b_bet_live: true,
  };
  live_bettors_table.push(info_json);
  io.emit("receive_live_betting_table", JSON.stringify(live_bettors_table));
  res.json(`Bet placed for ${req.user.username}`);
});

app.get("/manual_cashout_early", checkAuthenticated, async (req, res) => {
  if (!game_phase) {
    return;
  }
  theLoop = await Game_loop.findById(GAME_LOOP_ID);
  let time_elapsed = (Date.now() - phase_start_time) / 1000.0;
  current_multiplier = (1.0024 * Math.pow(1.0718, time_elapsed)).toFixed(2);
  if (
    current_multiplier <= game_crash_value &&
    theLoop.active_player_id_list.includes(req.user.id)
  ) {
    const currUser = await User.findById(req.user.id);
    currUser.balance += currUser.bet_amount * current_multiplier;
    await currUser.save();
    await theLoop.updateOne({ $pull: { active_player_id_list: req.user.id } });
    for (const bettorObject of live_bettors_table) {
      if (bettorObject.the_user_id === req.user.id) {
        bettorObject.cashout_multiplier = current_multiplier;
        bettorObject.profit =
          currUser.bet_amount * current_multiplier - currUser.bet_amount;
        bettorObject.b_bet_live = false;
        io.emit(
          "receive_live_betting_table",
          JSON.stringify(live_bettors_table)
        );
        break;
      }
    }
    res.json(currUser);
  } else {
  }
});

app.get("/auto_cashout_early", checkAuthenticated, async (req, res) => {
  if (!game_phase) {
    return;
  }
  theLoop = await Game_loop.findById(GAME_LOOP_ID);
  let time_elapsed = (Date.now() - phase_start_time) / 1000.0;
  current_multiplier = (1.0024 * Math.pow(1.0718, time_elapsed)).toFixed(2);
  if (
    req.user.payout_multiplier <= game_crash_value &&
    theLoop.active_player_id_list.includes(req.user.id)
  ) {
    const currUser = await User.findById(req.user.id);
    currUser.balance += currUser.bet_amount * currUser.payout_multiplier;
    await currUser.save();
    await theLoop.updateOne({ $pull: { active_player_id_list: req.user.id } });
    for (const bettorObject of live_bettors_table) {
      if (bettorObject.the_user_id === req.user.id) {
        bettorObject.cashout_multiplier = currUser.payout_multiplier;
        bettorObject.profit =
          currUser.bet_amount * current_multiplier - currUser.bet_amount;
        bettorObject.b_bet_live = false;
        io.emit(
          "receive_live_betting_table",
          JSON.stringify(live_bettors_table)
        );
        break;
      }
    }
    res.json(currUser);
  }
});

app.post("/send_message_to_chatbox", checkAuthenticated, async (req, res) => {
  user_message = req.body.message_to_textbox;
  message_json = {
    the_user_id: req.user.id,
    the_username: req.user.username,
    message_body: user_message,
    the_time: new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
    the_date: new Date().toLocaleDateString(),
  };
  theLoop = await Game_loop.findById(GAME_LOOP_ID);
  const somevar = await Game_loop.findOneAndUpdate(
    { _id: GAME_LOOP_ID },
    { $push: { chat_messages_list: message_json } }
  );

  messages_list.push(message_json);
  io.emit(
    "receive_message_for_chat_box",
    JSON.stringify(theLoop.chat_messages_list)
  );
  res.send("Message sent");
});

app.get("/get_chat_history", async (req, res) => {
  theLoop = await Game_loop.findById(GAME_LOOP_ID);
  res.json(theLoop.chat_messages_list);
  return;
});

app.get("/retrieve_active_bettors_list", async (req, res) => {
  io.emit("receive_live_betting_table", JSON.stringify(live_bettors_table));
  res.json(live_bettors_table);
});
app.post("/depositaccount", checkAuthenticated, async (req, res) => {
  console.log(req.user);
  var data = {
    amount: req.body.amount,
    total_amount: req.body.amount,
    phone: "254" + req.user.phonenumber.slice(1),
    id: req.user._id,
    socketid: req.body.socketid,
    call_back: "https://api.wiggolive.com/deposit",
  };
  console.log("data", data);
  Axios({
    method: "POST",
    data: data,
    withCredentials: true,
    url: "https://sunpay.co.ke/api/mpesac2b",
  }).then(async (res) => {
    console.log(res.data);
  });
});

app.post("/verify_mpesa_code", checkAuthenticated, async (req, res) => {
  console.log(req.user);
  var data = {
    code: req.body.code,
    call_back: "https://api.wiggolive.com/verify_code",
    socketId: req.body.socketid,
  };
  console.log("data", data);
  Axios({
    method: "POST",
    data: data,
    withCredentials: true,
    url: "https://sunpay.co.ke/api/mpesa/status",
  }).then(async (ress) => {
    console.log(ress.data);
    return res.json(ress.data);
  });
});

app.post("/verify_code", async (req, res) => {
  console.log(req.query);
  console.log(req.body);
  if (req.body["Result"]["ResultParameters"] === undefined) {
    io.to(req.query.socketId).emit("code_verified", {
      status: 500,
      message: "invalid mpesa code, please correct and try again",
    });
    res.json({ status: 500, message: "error" });
    return;
  }
  var phone, amount, transcode;
  req.body["Result"]["ResultParameters"]["ResultParameter"].forEach((e, r) => {
    if (e["Key"] == "DebitPartyName") {
      console.log(e["Value"]);
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
    io.to(req.query.socketId).emit("code_verified", {
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
    io.to(req.query.socketId).emit("code_verified", {
      status: 500,
      message: "Transaction code has been used already",
    });
    res.json({ status: 500, message: "dublicate" });
  } else {
    var bf = phone.slice(3);
    var phone = phone.length == 10 ? phone : "0" + bf;
    console.log(phone, amount, transcode);
    const currUser = await User.findOne({ phonenumber: phone });
    currUser.balance += amount;
    console.log(currUser);
    currUser.save();

    const transaction = new Transaction({
      amount: amount,
      user: currUser._id,
      transaction_code: transcode,
    });
    await transaction.save();

    io.to(req.query.socketId).emit("code_verified", {
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
app.post("/deposit", async (req, res) => {
  var transaction_code = req.body.transactionid;
  console.log(req.body);
  const transactions = await Transaction.find({
    transaction_code: transaction_code,
  });
  if (transactions.length > 0) {
    res.json({ status: 500, message: "dublicate" });
  } else {
    var amount = parseInt(req.body.amount);
    var socketid = req.body.socketid;
    var id = req.body.id;
    //     io.to(socketid).emit("deposit_success", amount);
    var bf = req.body.phone.slice(3);
    var phone = req.body.phone.length == 10 ? req.body.phone : "0" + bf;
    const currUser = await User.findOne({ phonenumber: phone });
    currUser.balance += amount;
    io.to(socketid).emit("deposit_success", currUser);
    currUser.save();

    const transaction = new Transaction({
      amount: amount,
      user: currUser._id,
      transaction_code: transaction_code,
    });
    await transaction.save();
    res.json(currUser);
  }
});

app.get("/retrieve_bet_history", async (req, res) => {
  let theLoop = await Game_loop.findById(GAME_LOOP_ID);
  // io.emit("crash_history", theLoop.previous_crashes);
  return res.send(theLoop.previous_crashes);
});
app.get("/creategame", async (req, res) => {
  await Game_loop().save(function (err, p, pp) {
    console.log(err, p, pp);
    console.log(p);
    return res.json(p);
  });
});

// app.listen(5000, () => { });

const cashout = async () => {
  theLoop = await Game_loop.findById(GAME_LOOP_ID);
  playerIdList = theLoop.active_player_id_list;
  crash_number = game_crash_value;
  for (const playerId of playerIdList) {
    const currUser = await User.findById(playerId);
    if (currUser.payout_multiplier <= crash_number) {
      currUser.balance += currUser.bet_amount * currUser.payout_multiplier;
      await currUser.save();
    }
  }
  theLoop.active_player_id_list = [];
  live_bettors_table = [];
  await theLoop.save();
};

// Run Game Loop
let phase_start_time = Date.now();
const pat = setInterval(async () => {
  await loopUpdate();
}, 1000);

// Game Loop
const loopUpdate = async () => {
  let time_elapsed = (Date.now() - phase_start_time) / 1000.0;
  if (betting_phase) {
    if (time_elapsed > 6) {
      sent_cashout = false;
      betting_phase = false;
      game_phase = true;
      io.emit("start_multiplier_count");
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
      const update_loop = await Game_loop.findById(GAME_LOOP_ID);
      await update_loop.updateOne({
        $push: {
          previous_crashes: {
            $each: [game_crash_value],
            $slice: 25,
            $position: 0,
          },
        },
      });
      //       await update_loop.updateOne({ $unset: { "previous_crashes.0": 1 } });
      await update_loop.updateOne({ $pull: { previous_crashes: null } });
      const the_round_id_list = update_loop.round_id_list;
      await update_loop.updateOne({
        $push: {
          round_id_list: the_round_id_list[the_round_id_list.length - 1] + 1,
        },
      });
      await update_loop.updateOne({ $unset: { "round_id_list.0": 1 } });
      await update_loop.updateOne({ $pull: { round_id_list: null } });
    }

    if (time_elapsed > 3) {
      cashout_phase = false;
      betting_phase = true;
      let randomInt = Math.floor(Math.random() * (9999999999 - 0 + 1) + 0);
      if (randomInt % 33 == 0) {
        game_crash_value = 1;
      } else {
        random_int_0_to_1 = Math.random();
        while (random_int_0_to_1 == 0) {
          random_int_0_to_1 = Math.random;
        }
        game_crash_value = 0.01 + 0.99 / random_int_0_to_1;
        game_crash_value = Math.round(game_crash_value * 100) / 100;
      }
      io.emit("update_user");
      io.emit("start_betting_phase");
      io.emit("testingvariable");
      let theLoop = await Game_loop.findById(GAME_LOOP_ID);
      io.emit("crash_history", theLoop.previous_crashes);
      //       io.emit("get_round_id_list", theLoop.round_id_list);
      // console.log(theLoop);
      live_bettors_table = [];
      phase_start_time = Date.now();
    }
  }
};

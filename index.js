const mongoose = require("mongoose");
const express = require("express");
const passport = require("passport");
const http = require("http");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");
const MongoDBStore = require('connect-mongodb-session')(session);

const Bet = require("./models/bet");
const Transaction = require("./models/Transaction");

require("dotenv").config();
const GAME_LOOP_ID = process.env.GAME_LOOP_ID;
const app = express();
const server = http.createServer(app); 
 
const User = require("./models/user");
const Game_loop = require("./models/game");
const Axios = require("axios");
require("dotenv").config();
var ObjectId = require("mongodb").ObjectId;
// Connect to MongoDB
const connect = function () {
  mongoose.connect(process.env.MONGOOSE_DB_LINK, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  }, (err) => {
    if (err) {
      setTimeout(connect, 5000);
    }
  });
}
connect();

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
const store = new MongoDBStore({
  uri: process.env.MONGOOSE_DB_LINK,
  // The 'expires' option specifies how long after the last time this session was used should the session be deleted.
  // Effectively this logs out inactive users without really notifying the user. The next time they attempt to
  // perform an authenticated action they will get an error. This is currently set to 1 hour (in milliseconds).
  // What you ultimately want to set this to will be dependent on what your application actually does.
  // Banks might use a 15 minute session, while something like social media might be a full month.
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


  socket.on("get_game_status", async (data) => {
    let theLoop = await Game_loop.findById(GAME_LOOP_ID);
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
  theLoop = await Game_loop.findById(GAME_LOOP_ID);
  // console.log(theLoop);
  socket.on("bet", async (data) => {
    console.log("bet data", data);
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
    console.log("manual_cashout_early live_bettors_table ", live_bettors_table);
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
          console.log({
            amount: bettorObject.amount * current_multiplier,
            user: bettorObject.userdata,
          });
          socket.emit("manual_cashout_early", {
            amount: bettorObject.bet_amount * current_multiplier,
            user: bettorObject.userdata,
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

          console.log(bettorObject);
          await Bet.findByIdAndUpdate(bettorObject.betId, {
            cashout_multiplier: bettorObject.cashout_multiplier,
            profit: bettorObject.profit,
          });

          break;
        }
      }

      //res.json(currUser);
    } else {
    }
  });
});

//Passport.js login/register system 
app.post("/login",  (req, res, next) => { 
  passport.authenticate("local", async (err, user, info) => {
    if (err) throw err;
    if (!user) {
      res.json({ status: 400, message: "Username or Password is Wrong" });
    } else {
      let existingSessions = await mongoose.connection.db.collection('sessions').find({
        'session.passport.user': user._id.toString(),
        _id: {
          $ne: req.session._id
        }
      }).toArray();

      if (existingSessions.length) {
        await mongoose.connection.db.collection('sessions').deleteMany({
          _id: {
            $in: existingSessions.map(({ _id }) => _id)
          }
        });
      }
      req.logIn(user, async (err) => {
        if (err) throw err;
        io.to(user.socketid).emit('update_user');

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
    res.json({ msg: "Password should be at least six characters.", status: false });
    return;
  }

  User.findOne({ _id: req.user._id }).then(async (user) => {
    console.log(user.password);
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

  console.log(req.body);
  var phone = req.body.phonenumber;
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
        phonenumber: phone
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
  console.log(req.body);
  const response = await User.findOneAndUpdate({ _id: req.user._id }, req.body, { new: true });
  console.log(response);
  res.send(response) 
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



app.get("/retrieve_active_bettors_list", async (req, res) => {
  io.emit("receive_live_betting_table", JSON.stringify(live_bettors_table));
  res.json(live_bettors_table);
});
app.post("/depositaccount", checkAuthenticated, async (req, res) => {
  console.log(req.body);
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
    url: "https://sunpay.co.ke/mpesa/deposit",
  }).then(async (ress) => {
    console.log(ress.data);

    const currUser = await User.findOne({ _id: req.user._id });
    currUser.socketid = req.user.socketid;
    console.log(currUser);
    currUser.save();
    res.json(ress.data);
    if (ress.data !== 200) {
      return;
    }

    console.log(ress.data);
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
    url: "https://sunpay.co.ke/mpesa/query",
  }).then(async (ress) => {
    console.log(ress.data);
    return res.json(ress.data);
  });
});

app.post("/verify_code", async (req, res) => {
  var query = JSON.parse(req.query.payload);
  console.log(query);
  console.log(req.body);
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
    console.log("Transaction code has been used already")
    io.to(query.socketId).emit("code_verified", {
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
app.post("/withdraw", checkAuthenticated, async (req, res) => {
  let amount = req.body.amount;
  if (amount > req.user.balance) {
    res.json({ status: 400, message: "you cannot withdraw more than " + req.user.balance })
  } else {
    Axios({
      method: "POST",
      data: { amount, phone: "254" + req.user.phonenumber.slice(1) },
      withCredentials: true,
      url: "https://sunpay.co.ke/mpesa/withdraw",
    }).then(async (ress) => {
      console.log(ress.data);
      if (ress.data.status == 200) {
        const currUser = await User.findOne({ _id: req.user._id });
        currUser.balance -= amount;
        currUser.save();
      }
      res.json(ress.data);
    });
  }
})
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
    var id = req.body.id;
    //     io.to(socketid).emit("deposit_success", amount);
    var bf = req.body.phone ? req.body.phone.slice(3) : req.body.phone;
    var phone = req.body.phone ? req.body.phone.length == 10 ? req.body.phone : "0" + bf : "";
    const currUser = await User.findOne({ phonenumber: phone });

    if (!currUser) {
      console.log("failed")
      return;
    }
    var socketid = currUser.socketid;
    console.log(currUser);
    currUser.balance += amount;
    io.to(socketid).emit("deposit_success", { user: currUser, amount });
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
app.get("/transactions", async (req, res, next) => {
  var transactions = await Transaction.find({ user: req.user._id }).sort({
    createdAt: -1,
  });
  res.json(transactions);
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
    if (time_elapsed > 10) {
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
      // const the_round_id_list = update_loop.round_id_list;
      // await update_loop.updateOne({
      //   $push: {
      //     round_id_list: the_round_id_list[the_round_id_list.length - 1] + 1,
      //   },
      // });
      // await update_loop.updateOne({ $unset: { "round_id_list.0": 1 } });
      // await update_loop.updateOne({ $pull: { round_id_list: null } });
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

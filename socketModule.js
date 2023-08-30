const io = require("socket.io");

module.exports = (server) => {
  const socketIo = io(server);

  socketIo.on("connection", async (socket) => {
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

            let taken = (bettorObject.bet_amount * current_multiplier).toFixed(
              2
            );
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
};

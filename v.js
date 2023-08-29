const cashout = async () => {
    playerIdList = theLoop.active_player_id_list;
    crash_number = game_crash_value;
    let totalBetMined = 0;
    let taken = 0;
    let totalWins = 0;
    for (const bettorObject of live_bettors_table) {
        const currUser = await User.findById(bettorObject.the_user_id);
        if (currUser.payout_multiplier > 0 && currUser.payout_multiplier <= crash_number) {
            currUser.balance += currUser.bet_amount * currUser.payout_multiplier;
            taken += currUser.bet_amount * currUser.payout_multiplier;
            totalWins += (currUser.bet_amount * currUser.payout_multiplier) - currUser.bet_amount
            await currUser.save();
        } else {
            totalBetMined += currUser.bet_amount;
        }
        betId = bettorObject.betId;
    }
    if (playerIdList.length > 0) {
        createGameStats(taken, totalWins, totalBetMined);
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
            phase_start_time = Date.now();
        }
    } else if (game_phase) {
        current_multiplier = (1.0024 * Math.pow(1.0718, time_elapsed)).toFixed(2);
        if (current_multiplier > game_crash_value) {
            game_phase = false;
            cashout_phase = true;
            phase_start_time = Date.now();
        }
    } else if (cashout_phase) {
        gameId = null;
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
            const availableResources = 50000;
            const maxAllowedCrashValue = availableResources / live_bettors_table.length;

            // Generate a game crash value that doesn't exceed the maximum allowed
            game_crash_value = generateCrashValue(maxAllowedCrashValue);


            // let randomInt = Math.floor(Math.random() * (9999999999 - 0 + 1) + 0);
            // if (randomInt % 33 == 0) {
            //     game_crash_value = 1;
            // } else {
            //     random_int_0_to_1 = Math.random();
            //     const adjustedCrashValue = Math.min(maxAllowedCrashValue, 0.01 + 0.99 / random_int_0_to_1);

            //     // while (random_int_0_to_1 == 0) {
            //     //     random_int_0_to_1 = Math.random();
            //     // }
            //     game_crash_value = 0.01 + 0.99 / random_int_0_to_1;
            //     game_crash_value = Math.round(game_crash_value * 100) / 100;
            // }
            live_bettors_table = [];
            phase_start_time = Date.now();
        }
    }

    
};

function generateCrashValue(maxAllowedCrashValue) {
    const randomInt = Math.floor(Math.random() * (9999999999 - 0 + 1) + 0);
    if (randomInt % 33 === 0) {
        return 1;
    } else {
        const random_int_0_to_1 = Math.random();
        const adjustedCrashValue = Math.min(maxAllowedCrashValue, 0.01 + 0.99 / random_int_0_to_1);
        return Math.round(adjustedCrashValue * 100) / 100;
    }
}
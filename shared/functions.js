
const axios = require('axios');
const crypto = require('crypto');
const user = require('../models/user');
const Bet = require('../models/bet');
const settings = require('../models/settings');
const { default: Axios } = require('axios');
const Transaction = require('../models/Transaction');
const promowiner = require('../models/promowiner');

// Function to generate a random integer between min and max (inclusive)
function getRandomInt(min, max) {
    const range = max - min + 1;
    return Math.floor(Math.random() * range) + min;
}
const getPhoneNumberWithoutPlus = (number) => {
    return number.replace(/\D+/g, ''); // Remove all non-digit characters
}
const validateKenyanPhoneNumber = (number) => {
    console.log(number);
    // Remove any non-digit characters
    const cleanNumber = number.replace(/\D/g, '');

    // Check if the number starts with '0'
    if (cleanNumber.startsWith('0')) {
        // Add the country code and remove the leading '0'
        return '+254' + cleanNumber.slice(1);
    }

    // If the number already has the country code, return as is
    if (cleanNumber.startsWith('+254')) {
        return cleanNumber;
    }

    // If the number is not valid, return null
    return null;
};
async function sendSms(phonenumber, text = "") {
    const url = process.env.SMS_END_POINT;
    const apiKey = process.env.SMS_API_KEY;
    let code = getRandomInt(606851, 362468);
    const data = {
        phone: phonenumber,
        sender_id: process.env.SMS_SHORT_CODE,
        message: text === "" ? `Your OTP code is ${code}` : text,
        'api_key': apiKey
    };
    let reponse = await axios.post(url, data);
    if (reponse.data[0].status_desc === 'Success') {
        return {
            status: 200,
            code
        };
    } else {
        return {
            status: 400,
            code: null
        };
    }

}
function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }

    return res.send("No User Authentication");
}


async function getHighestCrasher() {
    var currentTimestamp = 1694574054000; // Your provided timestamp in milliseconds
    var nextHourTimestamp = currentTimestamp + (60 * 60 * 1000); // Add one hour in milliseconds

    // Display the timestamps
    // console.log(currentTimestamp);
    // console.log(nextHourTimestamp);

    var startDate = new Date(currentTimestamp);
    var endDate = new Date(nextHourTimestamp);
    // console.log(startDate, endDate);
    let response = await Bet.aggregate([
        {
            $match: {
                // createdAt: {
                //     $gte: startDate,  // Start time of the one-hour range
                //     $lt: endDate    // End time of the one-hour range
                // }
                cashout_multiplier: { $gt: 0 }
            }
        },
        {
            $sort: { cashout_multiplier: -1 } // Sort by cashout_multiplier in descending order
        },
        {
            $limit: 3 // Limit the results to the top 3 bets
        },
        {
            $lookup: {
                from: "users", // Name of the User model
                localField: "user",
                foreignField: "_id", // Assuming "_id" is the field that links bets to users
                as: "userDetails"
            }
        },
        {
            $unwind: "$userDetails" // Unwind the array produced by $lookup
        },
        {
            $project: {
                id: "$userDetails._id",
                username: "$userDetails.username",
                cashout_multiplier: 1
            }
        }
    ]);
    return response;

}

function getHighestCashoutMultiplier(data) {
    if (!data || data.length === 0) {
        return null;
    }

    return data.reduce((highestObject, currentObject) => {
        return currentObject.cashout_multiplier > highestObject.cashout_multiplier
            ? currentObject
            : highestObject;
    });
}

async function awardUsers() {
    let highestcrashers = await getHighestCrasher();
    console.log("highestcrashers", highestcrashers);


    const max = {
        _id: "6501bd48e3e1d0b938fbd8da",
        cashout_multiplier: 1.63,
        id: "64e735f4373ec7220d93068c",
        username: "fred"
    };

    // const max = getHighestCashoutMultiplier(highestcrashers)
    console.log("max", max);
    let userData = await user.findById({ "_id": max.id });
    console.log("userData", userData);
    if (userData) {
        let gameSettings = await settings.findById(process.env.SETTINGS_ID);
        console.log("gameSettings", gameSettings);
        if (gameSettings) {
            let amount = gameSettings.promoAmount;
            let charges = 33; //gameSettings.promoAmount > 1000 ? 23 : parseInt(gameSettings.withdrawcharges);
            console.log("amount", amount);
            if (amount > 0) {
                let userBalance = userData.balance + amount;
                const transaction = new Transaction({
                    amount: amount,
                    total: amount,
                    user: userData._id,
                    type: "crasher",
                    status: false,
                    voided: false,
                    charges,
                    housedeductions: charges,
                    balance: userBalance
                });
                transaction.save();



                const promo = new promowiner({
                    user: userData._id,
                    transaction: transaction._id,
                    criteria: max.cashout_multiplier,
                    amount: amount,
                    type: "crasher",
                    status: false,
                });
                promo.save();

                // let response = await callWithdrawApi({
                //     amount: amount,
                //     phone: userData.phonenumber,
                //     transactionId: transaction._id,
                // })
                // console.log("response", response); 
            }
        }
    }
}

async function callWithdrawApi(data) {
    return Axios({
        method: "POST",
        data: data,
        withCredentials: true,
        url: process.env.MPESA_WITHDRAW_URL,
    }).then(async (ress) => ress.data);
}
module.exports = {
    sendSms,
    validateKenyanPhoneNumber,
    getPhoneNumberWithoutPlus,
    checkAuthenticated,
    getHighestCrasher,
    callWithdrawApi,
    awardUsers
}
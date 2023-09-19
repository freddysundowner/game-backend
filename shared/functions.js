
const axios = require('axios');
const crypto = require('crypto');
const user = require('../models/user');
const Bet = require('../models/bet');
const settings = require('../models/settings');
const { default: Axios } = require('axios');
const Transaction = require('../models/Transaction');
const promowiner = require('../models/promowiner');
const fs = require('fs');
const filePath = 'top_three_elements.json';
let minLimit = 2;
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
    // 	return [];
    let gameSettings = await settings.findById(process.env.SETTINGS_ID);
    var currentTimestamp = gameSettings.lastPromoTime;// 1694671227000; // Your provided timestamp in milliseconds
    var nextHourTimestamp = currentTimestamp + (60 * 60 * 1000); // Add one hour in milliseconds


    var startDate = new Date(currentTimestamp);
    var endDate = new Date(nextHourTimestamp);
    // console.log(startDate, endDate);
    let response = await Bet.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: startDate,
                    $lt: endDate // Add 1 hour to the specific date
                },
                cashout_multiplier: { $gt: 0 },
                bet_amount: { $gte: 20 }
            }
        },
        {
            $sort: { user: 1, cashout_multiplier: -1 } // Sort by user (ascending) and multiplier (descending)
        },
        {
            $group: {
                _id: "$user",
                topBet: { $first: "$$ROOT" } // Select the document with the highest multiplier for each user
            }
        },
        {
            $lookup: {
                from: "users", // Replace with the actual name of your "users" collection
                localField: "_id",
                foreignField: "_id",
                as: "userData"
            }
        },
        {
            $unwind: "$userData"
        },
        {
            $replaceRoot: {
                newRoot: {
                    $mergeObjects: ["$topBet", { username: "$userData.username", id: "$userData._id" }]
                }
            }
        },
        {
            $project: {
                userData: 0
            }
        },
        {
            $sort: { cashout_multiplier: -1 } // Sort the final result by cashout_multiplier in descending order
        },
        {
            $limit: 1 // Limit the result to the top 3 records
        }
    ])
    if (gameSettings.allowbots === true) {
        const jsonData = await readJsonFile(filePath);
        if (response.length > 0) {
            try {
                const topThreeElements = jsonData.slice(0, 2);
                topThreeElements.push(response[0])
                let newarray = topThreeElements.sort((a, b) => b.cashout_multiplier - a.cashout_multiplier);

                return newarray;
            } catch (error) {
                console.error('Error:', error);
                throw error;
            }
        } else {
            return jsonData;
        }
    } else {
        return response;
    }



}


function readJsonFile(filePath) {
    if (fs.existsSync(filePath)) {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve(jsonData);
                    } catch (parseError) {
                        reject(parseError);
                    }
                }
            });
        });
    } else {
        console.error(`File '${filePath}' does not exist. reading`);
    }
}


const saveDummy = (topThreeElements) => {

    // 	if (fs.existsSync(filePath)) {
    // Convert the topThreeElements array to JSON format
    const jsonData = JSON.stringify(topThreeElements, null, 2);

    // Write the JSON data to the file
    fs.writeFile(filePath, jsonData, (err) => {
        if (err) {
            console.error('Error writing to file:', err);
        } else {
            console.log('Data saved to file:', filePath);
        }
    });
    /*
        } else {
            console.error(`File '${filePath}' does not exist. writing`);
        }
    */
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
// Function to generate a random username
function generateRandomUsername() {
    // You can customize this function to generate random usernames
    // For example, you can use a list of possible usernames and pick one randomly
    const possibleUsernames = ["kariuki", "f19", "wangu", "h254", "Njeri", "Eliz", "john", "nfat", "flet", "patrick", "mwangif", "honest"];
    const randomIndex = Math.floor(Math.random() * possibleUsernames.length);
    return possibleUsernames[randomIndex];
}





async function awardUsers() {
    let highestcrashers = await getHighestCrasher();
    console.log("highestcrashers", highestcrashers);

    const max = getHighestCashoutMultiplier(highestcrashers)
    console.log("max", max);
    if (max == null || max.id ==undefined) {
        let newsettings = await settings.findByIdAndUpdate(
            {
                "_id": process.env.SETTINGS_ID
            },
            {
                $set: { lastPromoTime: Date.now() },
            }, {
            upsert: true,
            returnOriginal: false,
        }); 
        saveDummy([])
        console.log("newsettings", newsettings);

        return;
    }
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
                let userBalance = userData.balance;
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

                //reset last promotime
                let newsettings = await settings.findByIdAndUpdate(
                    {
                        "_id": process.env.SETTINGS_ID
                    },
                    {
                        $set: { lastPromoTime: Date.now() },
                    }, {
                    upsert: true,
                    returnOriginal: false,
                });
                console.log("newsettings", newsettings);

				saveDummy([])
                let response = await callWithdrawApi({
                    amount: amount,
                    phone: userData.phonenumber,
                    transactionId: transaction._id,
                })
                console.log("response", response); 
            }
        }
    } else {
        let newsettings = await settings.findByIdAndUpdate(
            {
                "_id": process.env.SETTINGS_ID
            },
            {
                $set: { lastPromoTime: Date.now() },
            }, {
            upsert: true,
            returnOriginal: false,
        });
        saveDummy([])
        console.log("newsettings", newsettings);
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
    awardUsers,
    readJsonFile,
    filePath,
    saveDummy,
    generateRandomUsername
}
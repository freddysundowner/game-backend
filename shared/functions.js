
const axios = require('axios');
const crypto = require('crypto');
const user = require('../models/user');

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
async function sendSms(phonenumber) {
    const url = process.env.SMS_END_POINT;
    const apiKey = process.env.SMS_API_KEY;
    let code = getRandomInt(606851, 362468);
    const data = {
        phone: phonenumber,
        sender_id: process.env.SMS_SHORT_CODE,
        message: `Your OTP code is ${code}`,
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

module.exports = {
    sendSms,
    validateKenyanPhoneNumber,
    getPhoneNumberWithoutPlus
}
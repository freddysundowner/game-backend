
const User = require("../models/user");
const Referal = require("../models/referal");
const { validateKenyanPhoneNumber, getPhoneNumberWithoutPlus } = require("../shared/functions");

const bcrypt = require("bcryptjs");
const passport = require("passport");
exports.register = async (req, res) => {
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
    let phonewithplus = validateKenyanPhoneNumber(req.body.phonenumber);
    if (phonewithplus === null) {
        res.json({ status: 400, message: "Phone number is invalid" });
        return;
    }
    let phone = getPhoneNumberWithoutPlus(phonewithplus);
    var username = req.body.username;
    var referal = req.body.referal;

    User.findOne({ phonenumber: phone }, async (err, doc) => {
        if (err) throw err;
        if (doc) res.json({ status: 400, message: "Phone number already exists" });
        if (!doc) {
            const hashedPassword = await bcrypt.hash(req.body.password, 10);
            let refereral = null;
            if (referal) {
                refereral = await User.findOne({ referalCode: referal });
            }
            const newUser = new User({
                username: username,
                password: hashedPassword,
                phonenumber: phone,
                referedBy: refereral ? refereral._id : null
            });
            await newUser.save();


            if (refereral) {
                const newReferal = new Referal({
                    user: refereral._id,
                    referal: newUser._id,
                });
                await newReferal.save();
            }
            res.json({ status: 200, message: "Registered in successfully" });
        }
    });

} 

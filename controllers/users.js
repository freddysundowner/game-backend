
const User = require("../models/user");

exports.getAllusers = async (req, res) => {

    let { type, page, limit } = req.query;
    const queryObject = {};


    if (type) {
        queryObject.$or = [{ type: { $regex: `${type}`, $options: "i" } }];
    }
    const pages = Number(page);
    const limits = Number(limit);
    const skip = (pages - 1) * limits;

    try {
        const totalDoc = await User.countDocuments(queryObject);
        let users = await User.find(queryObject)
            .skip(skip)
            .limit(limits)
            .sort("-_id");

        res.send({
            users,
            totalDoc,
            limits,
            pages,
        });
    } catch (err) {
        res.status(500).send({
            message: err.message,
        }); 
    }
}
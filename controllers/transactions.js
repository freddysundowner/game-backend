const Transactions = require("../models/Transaction");
const User = require("../models/user");

exports.dashboardTransactions = async (req, res) => {
    try {
        const deposits = await Transactions.aggregate([
            {
                $match: {
                    type: "deposit",
                },
            },
            {
                $group: {
                    _id: null,
                    amount: { $sum: "$amount" },
                    count: {
                        $sum: 1,
                    },
                },
            },
        ]);
        const withdraw = await Transactions.aggregate([
            {
                $match: {
                    type: "withdraw",
                },
            },
            {
                $group: {
                    _id: null,
                    amount: { $sum: "$amount" },
                    count: {
                        $sum: 1,
                    },
                },
            },
        ]);
        const wallettotals = await User.aggregate([
            {
                $group: {
                    _id: null,
                    amount: { $sum: "$balance" },
                    count: {
                        $sum: 1,
                    },
                },
            },
        ]);
        res.send({
            deposits: deposits.length > 0 ? parseFloat(deposits[0]["amount"].toFixed(2)) : 0,
            withdraw: withdraw.length > 0 ? parseFloat(withdraw[0]["amount"].toFixed(2)) : 0,
            wallettotals: wallettotals.length > 0 ? parseFloat(wallettotals[0]["amount"].toFixed(2)) : 0
        });
    } catch (error) {
        res.status(500).send({
            message: error.message,
        });
    }
}
exports.getAllTransactions = async (req, res) => {
    let { type, page, limit } = req.query;
    const queryObject = {};


    if (type) {
        queryObject.$or = [{ type: { $regex: `${type}`, $options: "i" } }];
    }
    const pages = Number(page);
    const limits = Number(limit);
    const skip = (pages - 1) * limits;

    try {
        const totalDoc = await Transactions.countDocuments(queryObject);
        let transactions = await Transactions
            .find(queryObject)
            .skip(skip)
            .limit(limits)
            .sort("-_id");

        res.send({
            transactions,
            totalDoc,
            limits,
            pages,
        });
    } catch (error) {
        res.status(500).send({
            message: error.message,
        });
    }
}


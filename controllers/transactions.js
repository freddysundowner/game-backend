const Transactions = require("../models/Transaction");
const User = require("../models/user");
const Bet = require("../models/bet");
var ObjectId = require("mongodb").ObjectId;

exports.getUserBets = async (req, res) => {
	console.log(req.query);
	let {user, bets} = req.query;
	if(bets){
		let { type, page, limit,user } = req.query;
	    const queryObject = {};
	    
	    if (user) {
	      queryObject.user = { $eq: user };
	    }
	    const pages = Number(page);
	    const limits = Number(limit);
	    const skip = (pages - 1) * limits;
	
	    try {
	        const totalDoc = await Bet.countDocuments(queryObject);
	        let bets = await Bet
	            .find(queryObject)
	            .skip(skip)
	            .limit(limits)
	            .sort("-_id");
	
	        res.send({
	            bets,
	            totalDoc,
	            limits,
	            pages,
	        });
	    } catch (error) {
	        res.status(500).send({
	            message: error.message,
	        });
	    }
	}else{
		const bets = await Bet.aggregate([
		    {
		        $match: {
		            user: ObjectId(user),
		            
		        },
		    },
		    {
		        $group: {
		            _id: null,
		            profit: { $sum: "$profit" },
		            bet_amount: { $sum: "$bet_amount" },
		            count: {
		                $sum: 1,
		            },
		        },
		    },
		]);
		 	res.send({
	            profit: bets.length > 0 ? parseFloat(bets[0]["profit"].toFixed(2)) : 0,
	            bet_amount: bets.length > 0 ? parseFloat(bets[0]["bet_amount"].toFixed(2)) : 0,
	        });
    }

}

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
        console.log(wallettotals)
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
    let { type, page, limit,user } = req.query;
    const queryObject = {};


    if (type) {
        queryObject.$or = [{ type: { $regex: `${type}`, $options: "i" } }];
    }
    
    if (user) {
      queryObject.user = { $eq: user };
    }
    if (type) {
      queryObject.type = { $eq: type };
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


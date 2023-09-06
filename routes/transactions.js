const express = require("express");
const transactionRouter = express.Router();
const transactions = require("../controllers/transactions");


transactionRouter
    .route(`/`)
    .get(
        transactions.getAllTransactions
    )
transactionRouter
    .route(`/dashboard`)
    .get(
        transactions.dashboardTransactions
    )
transactionRouter
    .route(`/userbets`)
    .get(
        transactions.getUserBets
    )
module.exports = transactionRouter;
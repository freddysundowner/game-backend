const { getHighestCrasher } = require("../shared/functions");

exports.getHighestCrash = async (req, res) => {
    try {
        let response = await getHighestCrasher();

        res.json({
            response
        });
    } catch (error) {
        res.status(500).send({
            message: error.message,
        });
    }
};


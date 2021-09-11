require('dotenv').config()
const compression = require('compression');
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require("express-rate-limit");
const cookieParser = require('cookie-parser')
const { setRoutes } = require('./routes');
const helmet = require('helmet');
const morgan = require('morgan');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
const server = express();
const port = process.env.PORT || 5002
server.listen(port, () => console.log(`Server started on port ${port}`));
server.use(compression())
server.use(cookieParser());
server.use(helmet());
server.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Headers', "x-access-token, Origin, Content-Type, Accept, content-type");
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    next();
});
server.use(cors());
server.use(limiter);
server.use(express.json({ limit: '1000kb' }))
server.use(express.urlencoded({ extended: true }));
server.use(morgan('combined'));
setRoutes(server);
server.get("*", function (req, res) {
    res.status(404).json({ apiCall: req.originalUrl, message: 'Invalid URL, this API call doesnt exist. This may be due to a minor spelling mistake check the url again.' });
})
module.exports = server
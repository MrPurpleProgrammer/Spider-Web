// const { verifySignUp } = require("../middleware");
const router = require('express').Router();
const scrapeController = require('../controllers/scrapeController');
const puppetController = require('../controllers/puppetController');

router.get('/scrape', (req, res, next) => {
    scrapeController.scrapeUrl(req, res, next).then((response) => {
        res.status(200).json(response);
    });
})

router.get('/cardekho', (req, res, next) => {
    scrapeController.scrapeCarDekho(req, res, next).then((response) => {
        res.status(200).json(response);
    });
})

module.exports = router
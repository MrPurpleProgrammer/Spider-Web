const Crawler = require("crawler");
const fs = require('fs');
const droomUrls = require('../scripts/crawler/www.droom.com.json');
const { chunks } = require("../utils/promiseUtils");
const cheerio = require('cheerio');
const { flattenObj } = require("../utils/jsonMods");

let crawler = new Crawler({
    userAgent: ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', 'Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)'],
    rotateUA: true,
    rateLimit: 1000,
    maxConnections: 10
});

function writeIntoUrlList(href, filepath) {
    let text = '"' + href + '", \n';
    fs.appendFileSync(filepath, text, { flags: 'a' });
}

function writeAsJson(filename, response, refName) {
    fs.readFile(filename, 'utf8', (err, data) => {
        if (err || !data || !response) {
            console.log(err);
            return;
        }
        else {
            obj = JSON.parse(data); //now it an object
            obj[refName].push(response); //add some data
            json = JSON.stringify(obj, null, 4); //convert it back to json
            if (json !== null || json !== '') {
                fs.writeFile(filename, json, 'utf8', (err) => {
                    if (err) console.log(err);
                }); // write it back 
            }
            else return;
        }
    });
}

function isValidHttpUrl(string) {
    let url;

    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }

    return url.protocol === "http:" || url.protocol === "https:";
}

async function crawlAndWrite(req, res, next, filename, baseUrl, obsolete) {
    crawler.queue({
        uri: baseUrl,
        callback: function (err, resp, done) {
            if (err) throw err;
            let $ = resp.$;
            try {
                let urls = $("a");
                if (urls.length == 0) {
                    done();
                    //res.status(400).json({ msg: 'No Links found in this Url', resp: resp })
                }
                Object.keys(urls).forEach((item) => {
                    if (urls[item].type === 'tag') {
                        let href = urls[item].attribs.href;
                        if (href && !obsolete.includes(href) && !href.includes('#') && !href.includes('javascript:') && !href.includes('tel:') && !href.includes('mailto:')) {
                            href = href.trim();
                            obsolete.push(href);
                            let urlHostName = new URL(req.body.url).hostname;
                            if (href.startsWith('/') || href.startsWith('.')) {
                                href = 'https://' + urlHostName + href;
                            }
                            else if (!isValidHttpUrl(href)) {
                                href = 'https://' + urlHostName + '/' + href;
                            }
                            if (typeof req.body.condition !== 'undefined') {
                                let hrefHostname = new URL(href).hostname;
                                if (typeof req.body.condition.includes !== 'undefined' && href.includes(req.body.condition.includes)) {
                                    if (hrefHostname === urlHostName) {
                                        //writeIntoUrlList(href, filename);
                                        writeAsJson(filename, href, 'urls')
                                    }
                                }
                                else if (typeof req.body.condition.startsWith !== 'undefined' && href.startsWith(req.body.condition.startsWith)) {
                                    if (hrefHostname === urlHostName) {
                                        //writeIntoUrlList(href, filename);
                                        writeAsJson(filename, href, 'urls')
                                    }
                                }
                                if (hrefHostname === urlHostName) {
                                    crawlAndWrite(req, res, next, filename, href, obsolete)
                                }
                                return
                            }
                            else {
                                let urlHostName = new URL(req.body.url).hostname;
                                let hrefHostname = new URL(href).hostname;
                                if (hrefHostname === urlHostName) {
                                    //writeIntoUrlList(href, filename);
                                    writeAsJson(filename, href, 'urls')
                                    crawlAndWrite(req, res, next, filename, href, obsolete)
                                }
                                return
                            }
                        }
                        return
                    }
                    return
                });
            } catch (e) {
                console.error(`Encountered an error crawling ${baseUrl}. Aborting crawl.`, e);
                done();
            }
            done();
            //res.status(200).json({ urls: obsolete });
        }
    })
}

function handleTypeVal(d, e, $) {
    //based on type of retrieval in the json body, handle various cheerio contexts
    let val;
    if (d.type.includes('html')) {
        val = $(e).html();
    }
    if (d.type.includes('text')) {
        val = $(e).text();
    }
    if (d.type.includes('attr')) {
        val = $(e).attr(d.typeVal);
    }
    if (d.type.includes('data')) {
        val = $(e).data(d.typeVal);
    }
    if (d.type.includes('find')) {
        val = $(e).find(d.typeVal);
    }
    if (d.type.includes('parents')) {
        if (d.typeVal !== null) {
            val = $(e).parents(d.typeVal);
        }
        else {
            val = $(e).parents(d.typeVal);
        }
    }
    if (d.type.includes('children')) {
        if (d.typeVal !== null) {
            val = $(e).children(d.typeVal);
        }
        else {
            val = $(e).children(d.typeVal);
        }
    }
    return val.trim().replace(/\n/g, "").replace('&#x20B9;', "");
}

function modifyDataInquiry($, requests, index) {
    //Modify Data Inquiry Object and Convert it to Html Results
    const request = requests[index];
    let modJson = [];
    request.data.map(data => {
        //loop through request data
        let htmlColl;
        //if query and name are defined in the body run this case
        if (typeof data.query !== 'undefined') {
            //get html object based on query
            if (data.query.includes(':eq')) {
                let pos = data.query.indexOf(':eq');
                let eqNum = data.query.substring(pos + 4, pos + 5)
                let newQuery = data.query.substring(0, pos);
                htmlColl = $(newQuery).eq(eqNum);
            }
            else {
                htmlColl = $(data.query);
            }
            htmlColl.each((i, html) => {
                //loop through html collection list
                let outputJson = new Object();
                //get query value
                outputJson[data.name] = handleTypeVal(data, html, $);
                if (typeof data.scrapeResult !== 'undefined') {
                    //if scrapeResult is defined, it means the returned value is a url, so you can further scrape that result
                    let scrapeResult = [
                        {
                            url: outputJson[data.name],
                            data: data.scrapeResult
                        }
                    ]
                    if (typeof requests[index].baseUrl !== 'undefined') scrapeResult['baseUrl'] = requests[index].baseUrl;
                    modJson[i] = { ...modJson[i], scrapeResult: scrapeResult };
                }
                else {
                    modJson[i] = { ...modJson[i], ...outputJson };
                }
            });
        }
        //if queryval and queryname are defined in the body run this case
        if (typeof data.query_name !== 'undefined' && typeof data.query_val !== 'undefined') {
            htmlCollName = $(data.query_name);
            htmlCollVal = $(data.query_val);
            htmlCollVal.each((i, html) => {
                let outputJson = new Object();
                let collName = $(htmlCollName[i]).text();
                outputJson[collName] = handleTypeVal(data, html, $);
                if (typeof data.scrapeResult !== 'undefined') {
                    let scrapeResult = [
                        {
                            url: outputJson[collName],
                            data: data.scrapeResult
                        }
                    ]
                    if (typeof requests[index].baseUrl !== 'undefined') scrapeResult['baseUrl'] = requests[index].baseUrl;
                    modJson[i] = { ...modJson[i], scrapeResult: scrapeResult };
                }
                else {
                    modJson[i] = { ...modJson[i], ...outputJson };
                }
            });
        }
    })
    return modJson
}

async function retrieveCrawlerData(r, i, arr, filename) {
    return new Promise((resolve, reject) => {
        crawler.queue({
            uri: r.url,
            jQuery: true,
            callback: function (err, resp, done) {
                if (err) throw err;
                try {
                    let url = r.url;
                    const $ = resp.$;
                    let dataset = modifyDataInquiry($, arr, i);
                    dataset = flattenObj(dataset);
                    const getMetatag = (name) =>
                        $(`meta[name=${name}]`).attr('content') ||
                        $(`meta[name="og:${name}"]`).attr('content') ||
                        $(`meta[property="og:${name}"]`).attr('content') ||
                        $(`meta[property="fb:${name}"]`).attr('content') ||
                        $(`meta[property="ai:${name}"]`).attr('content') ||
                        $(`meta[name="twitter:${name}"]`).attr('content');
                    let response = {
                        url,
                        title: $('title').first().text(),
                        favicon: $('link[rel="shortcut icon"]').attr('href'),
                        description: getMetatag('description'),
                        image: getMetatag('image'),
                        author: getMetatag('author'),
                        // html: html,
                        data: [dataset]
                    }
                    if (filename !== null) {
                        writeAsJson(filename, response, 'results');
                    }
                    resolve(response);
                }
                catch (e) {
                    console.error(`Encountered an error crawling ${r.url}. Aborting crawl.`, e);
                    done();
                }
                done();
            }
        })
    });
}

async function retrieveDroomCrawlerData(r, i, arr) {
    return new Promise((resolve, reject) => {
        crawler.queue({
            uri: r.url,
            jQuery: true,
            callback: function (err, resp, done) {
                if (err) throw err;
                try {
                    let url = r.url;
                    const $ = resp.$;
                    const getMetatag = (name) =>
                        $(`meta[name=${name}]`).attr('content') ||
                        $(`meta[name="og:${name}"]`).attr('content') ||
                        $(`meta[property="og:${name}"]`).attr('content') ||
                        $(`meta[property="fb:${name}"]`).attr('content') ||
                        $(`meta[property="ai:${name}"]`).attr('content') ||
                        $(`meta[name="twitter:${name}"]`).attr('content');
                    let response = {
                        url,
                        title: $('title').first().text(),
                        favicon: $('link[rel="shortcut icon"]').attr('href'),
                        description: getMetatag('description'),
                        image: getMetatag('image'),
                        author: getMetatag('author'),
                        // html: html,
                        data: [
                            {
                                carName: $('.product_sidebar .detailBlock .page-header h1').html().trim().replace(/\n/g, ""),
                                carDetails: $('.product_sidebar .detailBlock .summary span').html().trim().replace(/\n/g, ""),
                                carPrice: $('.price .offer>.text-decoration').html().trim().replace(/:/g, "\n")
                            }

                        ]
                    }
                    resolve(response);
                }
                catch (e) {
                    console.error(`Encountered an error crawling ${r.url}. Aborting crawl.`, e);
                    done();
                }
                done();
            }
        })
    });
}

async function crawlAndRetrieve(requests, filename) {
    let response;
    response = await chunks(requests, retrieveCrawlerData, 50, filename);
    return Promise.all(response);
}

module.exports = {
    crawlAndWrite, retrieveCrawlerData, crawlAndRetrieve, retrieveDroomCrawlerData
}
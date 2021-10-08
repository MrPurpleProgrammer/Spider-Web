const puppeteer = require('puppeteer');
const { init } = require('../server');

const initiatePuppet = async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    return { page: page, broswer: browser };
}

const autoScroll = async (page, timeout) => {
    await page.setViewport({
        width: 1200,
        height: 800
    });
    await page.addScriptTag({ url: 'https://code.jquery.com/jquery-3.2.1.min.js' });
    return await page.evaluate(async (timeout) => {
        await new Promise((resolve, reject) => {
            let totalHeight = 0;
            let distance = 100;
            let startTime = new Date().getTime();
            let timer = setInterval(() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (new Date().getTime() - startTime > timeout * 1000) {
                    clearInterval(timer);
                    resolve();
                }
            }, 400);
        });
    }, timeout);
}

const scroll = async (page) => {
    await page.setViewport({
        width: 1200,
        height: 800
    });
    await page.addScriptTag({ url: 'https://code.jquery.com/jquery-3.2.1.min.js' });
    return await page.evaluate(async () => {
        await new Promise((resolve) => {
            let scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, scrollHeight);
            resolve();
        });
    });
}

const autoClick = async (page, timeout, selector) => {
    await page.setViewport({
        width: 1200,
        height: 800
    });
    await page.addScriptTag({url: 'https://code.jquery.com/jquery-3.2.1.min.js'});
    return await page.evaluate(async (timeout, selector) => {
        await new Promise((resolve, reject) => {
            let startTime = new Date().getTime();
            let timer = setInterval(() => {
                $(selector).click();
                if (new Date().getTime() - startTime > timeout * 1000) {
                    clearInterval(timer);
                    resolve();
                }
            }, 400);
        });
    }, timeout, selector);
}

const clickElm = async (page, selector) => {
    return await Promise.all([
        page.waitForSelector(selector),
        page.click(selector),
    ]);
};

module.exports = {
    initiatePuppet,
    autoScroll,
    clickElm,
    autoClick,
    scroll
}
const puppeteer = require('puppeteer');
const { init } = require('../server');

const initiatePuppet = async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.addScriptTag({ url: 'https://code.jquery.com/jquery-3.2.1.min.js' });
    return { page: page, broswer: browser };
}

const autoScroll = async (page, timeout) => {
    await page.setViewport({
        width: 1200,
        height: 800
    });
    return await page.evaluate(async (timeout) => {
        await new Promise((resolve, reject) => {
            let totalHeight = 0;
            let distance = 100;
            let startTime = new Date().getTime();
            let timer = setInterval(() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if(new Date().getTime() - startTime > timeout*1000){
                    clearInterval(timer);
                    resolve();
                }
            }, 400);
        });
    }, timeout);
}

module.exports = {
    initiatePuppet,
    autoScroll
}
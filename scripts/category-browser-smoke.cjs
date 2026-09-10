const {spawn} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outputDirectory = path.resolve(__dirname, '../.local');
const profile = path.join(outputDirectory, 'chrome-category-smoke');
const port = 9334;
let chrome;

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function connect() {
    let version;
    for (let attempt = 0; attempt < 50; attempt++) {
        try {
            version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
            break;
        } catch {
            await delay(200);
        }
    }
    if (!version) throw new Error('Headless Chrome did not start.');
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, {method: 'PUT'})).json();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        socket.onopen = resolve;
        socket.onerror = () => reject(new Error('Could not connect to Chrome DevTools.'));
    });
    let nextId = 1;
    const pending = new Map();
    socket.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
            const callback = pending.get(message.id);
            pending.delete(message.id);
            message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result);
        }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, {resolve, reject});
        socket.send(JSON.stringify({id, method, params}));
    });
    return {socket, send};
}

async function waitFor(send, expression, message) {
    for (let attempt = 0; attempt < 60; attempt++) {
        const result = await send('Runtime.evaluate', {expression, returnByValue: true});
        if (result.result.value) return result.result.value;
        await delay(250);
    }
    throw new Error(message);
}

async function capture(send, name) {
    const result = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
    const destination = path.join(outputDirectory, name);
    fs.writeFileSync(destination, Buffer.from(result.data, 'base64'));
    return path.relative(process.cwd(), destination);
}

async function navigate(send, url) {
    await send('Page.navigate', {url});
    await waitFor(send, 'document.readyState === "complete" && document.body.innerText.length > 100', `Page did not render: ${url}`);
}

async function main() {
    fs.mkdirSync(outputDirectory, {recursive: true});
    fs.mkdirSync(profile, {recursive: true});
    chrome = spawn(chromePath, [
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
    ], {windowsHide: true, stdio: 'ignore'});
    const {socket, send} = await connect();
    try {
        await send('Page.enable');
        await send('Runtime.enable');
        await send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false});
        await navigate(send, 'http://localhost:3001/en');
        const desktop = await waitFor(send, `(() => {
            const expected = ['Cleaning Chemicals','Paper, Liners & Disposables','Cleaning Tools & Supplies','Equipment & Material Handling','Ice & Winter Care','Office Supplies'];
            const text = document.body.innerText;
            const footerText = document.querySelector('footer')?.innerText || '';
            return expected.every(name => text.includes(name)) && expected.every(name => footerText.includes(name)) && text.includes('Featured Products') ? {parents: expected.length,footerParents: expected.length} : false;
        })()`, 'Desktop category navigation or Featured Products did not render.');
        await send('Runtime.evaluate', {expression: `([...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Cleaning Chemicals')?.click(), true)`});
        await waitFor(send, `document.body.innerText.includes('Air Care') && document.body.innerText.includes('Floor Strippers & Finishes')`, 'Desktop category dropdown did not open.');
        const desktopScreenshot = await capture(send, 'storefront-categories-desktop.png');

        await navigate(send, 'http://localhost:3001/en/collection/cleaning-chemicals');
        const parentPage = await waitFor(send, `(() => {
            const text = document.body.innerText;
            const expected = ['Air Care','Cleaners & Polishes','Disinfectants & Sanitizers','Floor Cleaners & Maintenance','Floor Strippers & Finishes','Hand Care'];
            return expected.every(name => text.includes(name)) ? {children: expected.length} : false;
        })()`, 'Parent collection page did not show its child category links.');
        const parentScreenshot = await capture(send, 'storefront-category-parent.png');

        await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
        await navigate(send, 'http://localhost:3001/en');
        const menuOpened = await send('Runtime.evaluate', {expression: `(() => {
            const button = [...document.querySelectorAll('button')].find(item => item.textContent.includes('Open menu'));
            if (!button) return false;
            button.click();
            return true;
        })()`, returnByValue: true});
        if (!menuOpened.result.value) throw new Error('Mobile menu trigger did not render.');
        await waitFor(send, `Boolean(document.querySelector('[role="dialog"]')) && document.body.innerText.includes('Cleaning Chemicals')`, 'Mobile category sheet did not open.');
        await send('Runtime.evaluate', {expression: `(() => {
            const dialog = document.querySelector('[role="dialog"]');
            const button = [...dialog.querySelectorAll('button')].find(item => item.textContent.trim() === 'Cleaning Chemicals');
            button?.click();
            return Boolean(button);
        })()`});
        await waitFor(send, `document.body.innerText.includes('Shop all Cleaning Chemicals') && document.body.innerText.includes('Air Care')`, 'Mobile category accordion did not expand.');
        const mobileScreenshot = await capture(send, 'storefront-categories-mobile.png');

        console.log(JSON.stringify({desktop, parentPage, desktopScreenshot, parentScreenshot, mobileScreenshot}));
    } finally {
        try { await send('Browser.close'); } catch {}
        socket.close();
    }
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
}).finally(() => {
    if (chrome && !chrome.killed) chrome.kill();
});

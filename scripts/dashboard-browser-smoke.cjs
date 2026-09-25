const {spawn} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({path:path.resolve(__dirname,'../apps/server/.env'),quiet:true});

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = path.resolve(__dirname,'../.local/chrome-dashboard-smoke');
const screenshot = path.resolve(__dirname,'../.local/netsuite-dashboard.png');
const port = 9333;
let chrome;

const delay = milliseconds => new Promise(resolve => setTimeout(resolve,milliseconds));

async function connect() {
    let version;
    for(let attempt=0;attempt<50;attempt++){
        try {version=await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();break;}
        catch {await delay(200);}
    }
    if(!version) throw new Error('Headless Chrome did not start.');
    const target=await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('http://localhost:3000/dashboard')}`,{method:'PUT'})).json();
    const socket=new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=()=>reject(new Error('Could not connect to Chrome DevTools.'));});
    let nextId=1;
    const pending=new Map();
    socket.onmessage=event=>{
        const message=JSON.parse(event.data);
        if(message.id&&pending.has(message.id)){
            const {resolve,reject}=pending.get(message.id);pending.delete(message.id);
            message.error?reject(new Error(message.error.message)):resolve(message.result);
        }
    };
    const send=(method,params={})=>new Promise((resolve,reject)=>{
        const id=nextId++;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));
    });
    return {socket,send};
}

async function main(){
    if(!process.env.SUPERADMIN_USERNAME||!process.env.SUPERADMIN_PASSWORD) throw new Error('Admin credentials are not configured.');
    fs.mkdirSync(profile,{recursive:true});
    chrome=spawn(chromePath,[
        '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
        `--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank',
    ],{windowsHide:true,stdio:'ignore'});
    const {socket,send}=await connect();
    try {
        await send('Page.enable');await send('Runtime.enable');
        await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
        await send('Page.navigate',{url:'http://localhost:3000/dashboard'});
        let inputCount=0;
        for(let attempt=0;attempt<40;attempt++){
            await delay(250);
            const inputs=await send('Runtime.evaluate',{expression:'document.querySelectorAll("input").length',returnByValue:true});
            inputCount=inputs.result.value;
            if(inputCount>=2)break;
        }
        if(inputCount<2)throw new Error('Dashboard login form did not render.');
        const globalObject=await send('Runtime.evaluate',{expression:'globalThis'});
        const login=await send('Runtime.callFunctionOn',{
            objectId:globalObject.result.objectId,
            functionDeclaration:`function(username,password){
                const inputs=[...document.querySelectorAll('input')];
                if(inputs.length<2) return {ok:false,reason:'login inputs missing'};
                const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
                setter.call(inputs[0],username);inputs[0].dispatchEvent(new Event('input',{bubbles:true}));
                setter.call(inputs[1],password);inputs[1].dispatchEvent(new Event('input',{bubbles:true}));
                const button=document.querySelector('button[type="submit"]')||document.querySelector('button');
                if(!button)return {ok:false,reason:'submit button missing'};
                button.click();return {ok:true};
            }`,
            arguments:[{value:process.env.SUPERADMIN_USERNAME},{value:process.env.SUPERADMIN_PASSWORD}],
            returnByValue:true,
        });
        if(!login.result.value?.ok) throw new Error(login.result.value?.reason||'Dashboard login failed.');
        await delay(4000);
        await send('Page.navigate',{url:'http://localhost:3000/dashboard/netsuite-sync'});
        await delay(5000);
        const state=await send('Runtime.evaluate',{expression:`({url:location.href,text:document.body.innerText})`,returnByValue:true});
        const value=state.result.value;
        if(!value.text.includes('NetSuite catalog sync')||!value.text.includes('Run 9')||!value.text.includes('Refresh category memberships')||!value.text.includes('collections Refreshed')) throw new Error(`Sync dashboard did not render the latest category controls at ${value.url}.`);
        await send('Page.navigate',{url:'http://localhost:3000/dashboard/netsuite-customers'});
        await delay(3000);
        const searchState=await send('Runtime.evaluate',{expression:`(async()=>{
            const delay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
            const input=document.querySelector('input[placeholder="Vendure login name or email"]');
            const button=[...document.querySelectorAll('button')].find(item=>item.textContent.includes('Find Vendure logins'));
            if(!input||!button)return {ok:false,reason:'contact search controls missing'};
            const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
            async function search(value){setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));await delay(50);button.click();for(let attempt=0;attempt<40;attempt++){await delay(250);const status=[...document.querySelectorAll('[aria-live="polite"]')].map(item=>item.textContent).find(text=>text);if(status)return status;}return '';}
            const linked=await search('sjanvey@janvey.com');
            setter.call(input,'not-registered@example.invalid');input.dispatchEvent(new Event('input',{bubbles:true}));await delay(50);button.click();
            let missing='';for(let attempt=0;attempt<40;attempt++){await delay(250);missing=[...document.querySelectorAll('[aria-live="polite"]')].map(item=>item.textContent).find(text=>text?.includes('not-registered@example.invalid'))||'';if(missing)break;}
            return {ok:true,linked,missing};
        })()`,awaitPromise:true,returnByValue:true});
        const contactSearch=searchState.result.value;
        if(!contactSearch?.ok||!contactSearch.linked.includes('already linked to PROF MAINTENANCE OF LI')||!contactSearch.missing.includes('No Vendure login found')) throw new Error(`Customer search feedback failed: ${JSON.stringify(contactSearch)}`);
        const capture=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        fs.writeFileSync(screenshot,Buffer.from(capture.data,'base64'));
        console.log(JSON.stringify({url:value.url,heading:true,run9:true,categoryRefresh:true,contactSearch,screenshot:path.relative(process.cwd(),screenshot)}));
    } finally {
        try {await send('Browser.close');} catch {}
        socket.close();
    }
}

main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>{if(chrome&&!chrome.killed)chrome.kill();});

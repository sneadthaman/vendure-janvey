// Read-only deployment diagnostic. Prints only the upstream status and error code/message.
const axios = require('axios');
const OAuth = require('oauth-1.0a');
const CryptoJS = require('crypto-js');

const required = name => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not configured`);
    return value;
};

async function main() {
    const endpoint = process.env.NETSUITE_IMAGES_RESTLET_URL ||
        'https://5013697.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=2213&deploy=1';
    const accountId = required('NETSUITE_ACCOUNT_ID');
    const consumerKey = required('NETSUITE_CONSUMER_KEY');
    const consumerSecret = required('NETSUITE_CONSUMER_SECRET');
    const tokenId = required('NETSUITE_TOKEN_ID');
    const tokenSecret = required('NETSUITE_TOKEN_SECRET');
    const url = new URL(endpoint);
    url.searchParams.set('offset', '0');
    url.searchParams.set('limit', '1');
    const oauth = new OAuth({
        consumer: {key: consumerKey, secret: consumerSecret},
        signature_method: 'HMAC-SHA256',
        hash_function: (base, key) => CryptoJS.HmacSHA256(base, key).toString(CryptoJS.enc.Base64),
    });
    const authorization = oauth.toHeader(oauth.authorize(
        {url: url.toString(), method: 'GET'},
        {key: tokenId, secret: tokenSecret},
    )).Authorization;
    try {
        const response = await axios.get(url.toString(), {
            headers: {Authorization: `${authorization}, realm="${accountId}"`},
            timeout: 30000,
            maxRedirects: 0,
        });
        console.log(JSON.stringify({status: response.status, keys: Object.keys(response.data)}));
    } catch (error) {
        const data = error.response?.data;
        const upstream = data?.error || data || {};
        const upstreamMessage = typeof upstream === 'string' ? upstream : upstream.message;
        console.log(JSON.stringify({
            status: error.response?.status || null,
            code: upstream.code || upstream.name || null,
            message: String(upstreamMessage || error.message).slice(0, 1000),
        }));
        process.exitCode = 1;
    }
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});

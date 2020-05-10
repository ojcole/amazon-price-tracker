const axios = require("axios");
const { JSDOM } = require("jsdom");
const player = require("play-sound")((opts = {}));
const Base64 = require("crypto-js/enc-base64");
const sha256 = require("crypto-js/sha256");
const agent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36";
const headers = {
    "User-Agent": agent,
};

const args = process.argv.slice(2);

if (args.length < 2) {
    console.error("invalid args, expected product code and priceline");
    process.exit(1);
}

const vals = new Set();
const priceline = parseInt(args[1]);
const quiet = args.includes("--quiet");

let product = args[0];
let minprice = Number.POSITIVE_INFINITY;
let val = -1;

if (!product.includes("amazon")) {
    product = `https://www.amazon.co.uk/gp/offer-listing/${product}/?condition=new&nonce=`;
} else if (!product.includes("?")) {
    product += "?nonce=";
} else {
    product += "&nonce=";
}

const parseAndCheck = (str) => {
    const doc = new JSDOM(str);
    const elem = doc.window.document.getElementsByClassName("olpOfferPrice")[0];

    return Number(elem.innerHTML.replace(/[^0-9,.-]/g, ""));
};

const makeCheck = (prod) => {
    return axios
        .get(prod, { headers })
        .then((res) => {
            const newVal = parseAndCheck(res.data);
            if (newVal != val && (!quiet || !vals.has(newVal))) {
                val = newVal;
                if (minprice > newVal) {
                    console.log("New Minimum Price:");
                }
                console.log(`£${newVal}`);
                if (newVal <= priceline) {
                    player.play(
                        "alert.wav",
                        { timeout: 10000, mplayer: ["-loop", 0] },
                        (_) => {}
                    );
                }
            }
            vals.add(newVal);
            minprice = Math.min(newVal, minprice);

            return true;
        })
        .catch((_) => false);
};

const generateToken = () => {
    return Base64.stringify(sha256(String(rand())));
};

const rand = () => Math.floor(Math.random() * 10000);

(async function main() {
    const token = generateToken();

    const success = await makeCheck(product + token);

    if (success) setTimeout(main, 60000);
    else setTimeout(main, 10000);
})();

const axios = require("axios");
const { JSDOM } = require("jsdom");
const Base64 = require("crypto-js/enc-base64");
const sha256 = require("crypto-js/sha256");
const readline = require("readline");
const stdin = process.stdin;

const initialErrorDelay = 10000;
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
const newItem = args.includes("--new");
const prime = args.includes("--prime");
const infoTime = 3600000;

let errorCount = 0;
let time = Date.now();
let errorDelay = initialErrorDelay;

let product = args[0];
let minprice = Number.POSITIVE_INFINITY;
let maxprice = Number.NEGATIVE_INFINITY;
let val = -1;

if (!product.includes("amazon")) {
    product = `https://www.amazon.co.uk/gp/offer-listing/${product}/`;
}

if (!product.includes("?")) {
    product += "?ie=UTF8";
}

if (newItem) {
    product += "&condition=new&f_new=true";
}

if (prime) {
    product += "&f_primeEligible=true";
}

product += "&nonce=";

const parseCost = (elem) =>
    elem == undefined ? 0 : Number(elem.innerHTML.replace(/[^0-9.-]/g, ""));
const parseAndCheck = (str) => {
    const doc = new JSDOM(str);
    const parent = doc.window.document.getElementsByClassName("olpOffer")[0];

    const priceElem = parent.getElementsByClassName("olpOfferPrice")[0];
    const shippingElem = parent.getElementsByClassName("olpShippingPrice")[0];

    return parseCost(priceElem) + parseCost(shippingElem);
};

const beep = (count, delay) => {
    if (count != 0) {
        process.stdout.write("\x07");

        setTimeout(() => beep(count - 1, delay), delay);
    }
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
            }
            if (newVal <= priceline) {
                beep(50, 100);
            }
            vals.add(newVal);
            minprice = Math.min(newVal, minprice);
            maxprice = Math.max(newVal, maxprice);

            return true;
        })
        .catch((err) => {
            return false;
        });
};

const generateToken = () => {
    return Base64.stringify(sha256(String(rand())));
};

const rand = () => Math.floor(Math.random() * 10000);

const logInfo = () => {
    console.log(
        `Current Price: £${val}, Peak Price: £${maxprice}, Lowest Price: £${minprice}`
    );
};

(async function main() {
    const now = Date.now();
    if (now - time > infoTime) {
        time = now;
        logInfo();
    }

    const token = generateToken();

    const success = await makeCheck(product + token);

    if (success) {
        setTimeout(main, 30000);

        errorCount = 0;

        if (errorDelay > initialErrorDelay) {
            errorDelay = initialErrorDelay;

            console.log("Recovered from slow mode");
        }
    } else {
        errorCount++;

        if (errorCount > 5 && errorDelay === initialErrorDelay) {
            if (errorDelay === initialErrorDelay) {
                console.log("5 errors in a row, entering slow mode");
            }

            errorDelay = (initialErrorDelay * errorCount) / 5;
        }

        setTimeout(main, errorDelay);
    }
})();

readline.emitKeypressEvents(stdin);

stdin.setRawMode(true);

stdin.on("keypress", (_, key) => {
    if (key && key.name == "i") {
        logInfo();
    }

    if (key && (key.name == "c" || key.name == "d") && key.ctrl) {
        process.exit();
    }
});

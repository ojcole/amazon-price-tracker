const axios = require("axios");
const { JSDOM } = require("jsdom");
const args = process.argv.slice(2);
const player = require("play-sound")((opts = {}));
const Base64 = require("crypto-js/enc-base64");
const sha256 = require("crypto-js/sha256");

if (args.length < 2) {
    console.error("invalid args, expected url and priceline");
    process.exit(1);
}

const vals = new Set();
const product = args[0];
const priceline = parseInt(args[1]);
const quiet = args.includes("--quiet");

let minprice = Number.POSITIVE_INFINITY;
let val = -1;

const parseAndCheck = (str) => {
    const doc = new JSDOM(str);
    const elem = doc.window.document.getElementById("priceblock_ourprice");

    return Number(elem.innerHTML.replace(/[^0-9,.-]/g, ""));
};

const makeCheck = (prod) => {
    axios
        .get(prod)
        .then((res) => {
            const newVal = parseAndCheck(res.data);
            if (newVal != val && (!quiet || !vals.has(newVal))) {
                val = newVal;
                if (minprice > newVal) {
                    console.log("New Minimum Price:");
                }
                console.log(`£${newVal}`);
                if (newVal <= priceline) {
                    player.play("alert.wav", { timeout: 10000 }, (_) => {});
                }
            }
            vals.add(newVal);
            minprice = Math.min(newVal, minprice);
        })
        .catch((_) => {});
};

const generateToken = () => {
    return Base64.stringify(sha256(String(rand())));
};

const rand = () => Math.floor(Math.random() * 10000);

setInterval(() => {
    const token = generateToken();

    makeCheck(product + `?=${token}`);
}, 5000);

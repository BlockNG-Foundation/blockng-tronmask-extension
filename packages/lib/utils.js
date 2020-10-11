import crypto from 'crypto';
import bip39 from 'bip39';
import bip32 from 'bip32';
import TronWeb from 'tronweb';
import pbkdf2 from 'pbkdf2';
import aesjs from "aes-js";
import { isAddressValid,pkToAddress } from "@tronscan/client/src/utils/crypto";
import {utils} from 'ethers';

const encryptKey = (password, salt) => {
    return pbkdf2.pbkdf2Sync(password, salt, 1, 256 / 8, 'sha512');
};

const AbiCoder = utils.AbiCoder;
const abiCoder = new AbiCoder();

const Utils = {
    encryptionAlgorithm: 'aes-256-ctr',
    hashAlgorithm: 'sha256',

    stringToByte(str) {
        var bytes = new Array();
        var len, c;
        len = str.length;
        for(var i = 0; i < len; i++) {
            c = str.charCodeAt(i);
            if(c >= 0x010000 && c <= 0x10FFFF) {
                bytes.push(((c >> 18) & 0x07) | 0xF0);
                bytes.push(((c >> 12) & 0x3F) | 0x80);
                bytes.push(((c >> 6) & 0x3F) | 0x80);
                bytes.push((c & 0x3F) | 0x80);
            } else if(c >= 0x000800 && c <= 0x00FFFF) {
                bytes.push(((c >> 12) & 0x0F) | 0xE0);
                bytes.push(((c >> 6) & 0x3F) | 0x80);
                bytes.push((c & 0x3F) | 0x80);
            } else if(c >= 0x000080 && c <= 0x0007FF) {
                bytes.push(((c >> 6) & 0x1F) | 0xC0);
                bytes.push((c & 0x3F) | 0x80);
            } else {
                bytes.push(c & 0xFF);
            }
        }
        return bytes;
    },

    byteToString(arr) {
        if(typeof arr === 'string') {
            return arr;
        }
        var str = '',
            _arr = arr;
        for(var i = 0; i < _arr.length; i++) {
            var one = _arr[i].toString(2),
                v = one.match(/^1+?(?=0)/);
            if(v && one.length == 8) {
                var bytesLength = v[0].length;
                var store = _arr[i].toString(2).slice(7 - bytesLength);
                for(var st = 1; st < bytesLength; st++) {
                    store += _arr[st + i].toString(2).slice(2);
                }
                str += String.fromCharCode(parseInt(store, 2));
                i += bytesLength - 1;
            } else {
                str += String.fromCharCode(_arr[i]);
            }
        }
        return str;
    },

    hash(string) {
        return crypto
            .createHash(this.hashAlgorithm)
            .update(string)
            .digest('hex');
    },

    encrypt(data, key) {
        const encoded = JSON.stringify(data);
        const cipher = crypto.createCipher(this.encryptionAlgorithm, key);

        let crypted = cipher.update(encoded, 'utf8', 'hex');
        crypted += cipher.final('hex');

        return crypted;
    },

    decrypt(data, key) {
        const decipher = crypto.createDecipher(this.encryptionAlgorithm, key);

        let decrypted = decipher.update(data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    },

    requestHandler(target) {
        return new Proxy(target, {
            get(target, prop) {
                // First, check if the property exists on the target
                // If it doesn't, throw an error
                if(!Reflect.has(target, prop))
                    throw new Error(`Object does not have property '${ prop }'`);

                // If the target is a variable or the internal 'on'
                // method, simply return the standard function call
                if(typeof target[ prop ] !== 'function' || prop === 'on')
                    return Reflect.get(target, prop);

                // The 'req' object can be destructured into three components -
                // { resolve, reject and data }. Call the function (and resolve it)
                // so the result can then be passed back to the request.
                return (...args) => {
                    if(!args.length)
                        args[ 0 ] = {};

                    const [ firstArg ] = args;

                    const {
                        resolve = () => {},
                        reject = ex => console.error(ex),
                        data
                    } = firstArg;

                    if(typeof firstArg !== 'object' || !('data' in firstArg))
                        return target[ prop ].call(target, ...args);

                    Promise.resolve(target[ prop ].call(target, data))
                        .then(resolve)
                        .catch(reject);
                };
            }
        });
    },

    generateMnemonic() {
        return bip39.generateMnemonic(128);
    },

    getAccountAtIndex(mnemonic, index = 0) {
        const seed = bip39.mnemonicToSeed(mnemonic);
        const node = bip32.fromSeed(seed);
        const child = node.derivePath(`m/44'/195'/${ index }'/0/0`);
        const privateKey = child.privateKey.toString('hex');
        const address = TronWeb.address.fromPrivateKey(privateKey);

        return {
            privateKey,
            address
        };
    },

    validateMnemonic(mnemonic) {
        return bip39.validateMnemonic(mnemonic);
    },

    injectPromise(func, ...args) {
        return new Promise((resolve, reject) => {
            func(...args, (err, res) => {
                if(err)
                    reject(err);
                else resolve(res);
            });
        });
    },

    isFunction(obj) {
        return typeof obj === 'function';
    },

    dataLetterSort (data, field, field2, topArray) {
        let needArray = [];
        if(topArray){
            topArray.forEach(v => {
                needArray.push(v)
            });
            data = data.filter(({tokenId})=> !topArray.map(v=>v.tokenId).includes(tokenId))
        }
        let list = {};
        let LetterArray = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','0','1','2','3','4','5','6','7','8','9'];
        for (let i = 0; i < data.length; i++) {
            const d = data[i][field] || data[i][field2] || data[i]['name'];
            let letter =  d.split('').filter(v=> v.match(/[a-zA-Z0-9]/)).join('').substr(0, 1).toUpperCase();
            if(!list[letter]) {
                list[letter] = [];
            }
            list[letter].push(data[i]);
        }
        LetterArray.forEach( v => {
            if(list[v]) {
                needArray = needArray.concat(list[v])
            }
        });
        return needArray;
    },

    validatInteger(str) { // integer
        const reg = /^\+?[1-9][0-9]*$/;
        return reg.test(str);
    },

    requestUrl() { // request url
        const curHost = location.hostname;
        let curApiHost;
        // const defaultUrl = 'http://52.14.133.221:8990'; //test
        const defaultUrl = 'https://manger.tronlending.org'; //online
        switch (curHost) {
            case 'nnceancbokoldkjjbpopcffaoekebnnb':
                curApiHost = defaultUrl;
                break;
            case 'ibnejdfjmmkpcnlpebklmnkoeoihofec':
                curApiHost = defaultUrl;
                break;
            default:
                curApiHost = defaultUrl;
                break;
        }
        return curApiHost;
    },

    timetransTime(date) {
        const newDate = new Date(date * 1000);
        const timeY = newDate.getFullYear();
        const timeM = (newDate.getMonth() + 1 < 10 ? `0${newDate.getMonth() + 1}` : newDate.getMonth() + 1);
        const timeD = (newDate.getDate() < 10 ? `0${newDate.getDate()}` : newDate.getDate());
        const timeh = (newDate.getHours() < 10 ? `0${newDate.getHours()}` : newDate.getHours());
        const timem = (newDate.getMinutes() < 10 ? `0${newDate.getMinutes()}` : newDate.getMinutes());
        return `${timeY}.${timeM}.${timeD} ${timeh}:${timem}`;
    },

    timeFormatTime(date) {
        const newDate = new Date(date * 1000);
        const timeY = newDate.getFullYear();
        const timeM = (newDate.getMonth() + 1 < 10 ? `0${newDate.getMonth() + 1}` : newDate.getMonth() + 1);
        const timeD = (newDate.getDate() < 10 ? `0${newDate.getDate()}` : newDate.getDate());
        const timeh = (newDate.getHours() < 10 ? `0${newDate.getHours()}` : newDate.getHours());
        const timem = (newDate.getMinutes() < 10 ? `0${newDate.getMinutes()}` : newDate.getMinutes());
        return `${timeY}/${timeM}/${timeD} ${timeh}:${timem}`;
    },

    readFileContentsFromEvent(ev) {
      return new Promise(resolve => {
        const files = ev.target.files;
        const reader = new FileReader();
        reader.onload = (file) => {
          const contents = file.target.result;
          resolve(contents);
        };

        reader.readAsText(files[0]);
      });
    },


    decryptString(password, salt, hexString) {
      const key = encryptKey(password, salt);
      const encryptedBytes = aesjs.utils.hex.toBytes(hexString);
      const aesCtr = new aesjs.ModeOfOperation.ctr(key);
      const decryptedBytes = aesCtr.decrypt(encryptedBytes);
      return aesjs.utils.utf8.fromBytes(decryptedBytes);
    },

    validatePrivateKey(privateKey){
        try {
            let address = pkToAddress(privateKey);
            return isAddressValid(address);
        } catch (e) {
            return false;
        }
    },

    delay(timeout){
        return new Promise(resolve => {
            setTimeout(resolve, timeout);
        });
    },

    decodeParams(message,abiCode,function_selector) {
        const cutArr = function_selector.match(/(.+)\((.*)\)/);
        if(cutArr[2]!==''){
            const byteArray = TronWeb.utils.code.hexStr2byteArray(message);
            const abi = abiCode.filter(({name})=> name === cutArr[1]);
            if(abi && abi[0]){
                return abi[0].inputs.map(({name,type},i)=>{
                    let value;
                    const array = byteArray.filter((v,index)=>index >=32 * i && index< 32 * (i + 1));
                    if(type === 'address') {
                        value = TronWeb.address.fromHex('41'+TronWeb.utils.code.byteArray2hexStr(array.filter((v,i) => i>11)));
                    } else if(type === 'trcToken') {
                        value = TronWeb.toDecimal('0x'+TronWeb.utils.code.byteArray2hexStr(array));
                    } else {
                        value = TronWeb.toDecimal('0x'+TronWeb.utils.code.byteArray2hexStr(array));
                    }
                    return {name,type,value};
                });
            } else {
                return [];
            }
        }else{
            return [];
        }
    },

    isObject(obj) {
        return obj === Object(obj) && Object.prototype.toString.call(obj) !== '[object Array]';
    },

    isInteger(number) {
        if (number === null)
            return false
        return Number.isInteger(
            Number(number)
        );
    },

    arrayEquals(arr, array) {
        if (!array)
            return false;
        if (arr.length !== array.length)
            return false;
        for (let i = 0, l = arr.length; i < l; i++) {
            if (arr[i] instanceof Array && array[i] instanceof Array) {
                if (!arr[i].equals(array[i]))
                    return false;
            } else if (arr[i] !== array[i]) {
                return false;
            }
        }
        return true;
    },

    getPerformanceTimingEntry() {
        let entryTimesList = [];
        let entryList = window.performance.getEntries();
        entryList.forEach((item, index) => {
            let templeObj = {};
            templeObj.Type = item.initiatorType;
            if (item.name === "first-paint") {
                templeObj.Type = "first-paint";
            }
            templeObj.tSize = item.transferSize;
            templeObj.sTime = parseInt(item.startTime);
            templeObj.name = item.name;
            templeObj.dur = parseInt(item.duration);
            templeObj.rStart = parseInt(item.requestStart);
            if (templeObj.dur > 0) {
                entryTimesList.push(templeObj);
            }
        });
        return entryTimesList;
    },

    // 计算加载时间
    getPerformanceTiming() {
        const performance = window.performance;
        if (!performance) {
            // 当前浏览器不支持
            console.log('你的浏览器不支持 performance 接口');
            return;
        }
        const t = performance.timing;
        let times = {};
        //【重要】页面加载完成的时间
        //【原因】这几乎代表了用户等待页面可用的时间
        times.loadPage = t.loadEventEnd - t.navigationStart;
        //【重要】解析 DOM 树结构的时间
        //【原因】反省下你的 DOM 树嵌套是不是太多了！
        times.domReady = t.domContentLoadedEventEnd - t.navigationStart;
        //【重要】重定向的时间
        //【原因】拒绝重定向！比如，http://example.com/ 就不该写成 http://example.com
        times.redirect = t.redirectEnd - t.redirectStart;
        //【重要】DNS 查询时间
        //【原因】DNS 预加载做了么？页面内是不是使用了太多不同的域名导致域名查询的时间太长？
        // 可使用 HTML5 Prefetch 预查询 DNS ，见：[HTML5 prefetch](http://segmentfault.com/a/1190000000633364)
        times.lookupDomain = t.domainLookupEnd - t.domainLookupStart;
        //【重要】读取页面第一个字节的时间
        //【原因】这可以理解为用户拿到你的资源占用的时间，加异地机房了么，加CDN 处理了么？加带宽了么？加 CPU 运算速度了么？
        // TTFB 即 Time To First Byte 的意思
        // 维基百科：https://en.wikipedia.org/wiki/Time_To_First_Byte
        times.ttfb = t.responseStart - t.navigationStart;
        //【重要】内容加载完成的时间
        //【原因】页面内容经过 gzip 压缩了么，静态资源 css/js 等压缩了么？
        times.request = t.responseEnd - t.requestStart;
        //【重要】执行 onload 回调函数的时间
        //【原因】是否太多不必要的操作都放到 onload 回调函数里执行了，考虑过延迟加载、按需加载的策略么？
        times.loadEvent = t.loadEventEnd - t.loadEventStart;
        // DNS 缓存时间
        times.appcache = t.domainLookupStart - t.fetchStart;
        // 卸载页面的时间
        times.unloadEvent = t.unloadEventEnd - t.unloadEventStart;
        // TCP 建立连接完成握手的时间
        times.connect = t.connectEnd - t.connectStart;
        return times;
    },

    MonitoringParameters() {
        if (window.performance || window.webkitPerformance) {
            const perf = window.performance || window.webkitPerformance;
            const time = perf.timing;
            let { loadPage, domReady, redirect, lookupDomain, ttfb, request, loadEvent, unloadEvent, connect } = this.getPerformanceTiming()
            const data = {
                url: window.location.href,
                timezone: new Date().getTimezoneOffset() / 60,
                browser: window.navigator.userAgent,
                pageLoadTime: loadPage < 0 ? 0 : loadPage,
                contentLoadTime: request < 0 ? 0 : request,
                dnsSearchTime: lookupDomain < 0 ? 0 : lookupDomain,
                domAnalyzeTime: domReady < 0 ? 0 : domReady,
                ttfbReadTime: ttfb < 0 ? 0 : ttfb,
                tcpBuildTime: connect < 0 ? 0 : connect,
                redirectTime: redirect < 0 ? 0 : redirect,
                onloadCallbackTime: loadEvent < 0 ? 0 : loadEvent,
                uninstallPageTime: unloadEvent < 0 ? 0 : unloadEvent,
                isMobile: false,
                navigationtype: performance.navigation.type,
                dompreload: time.responseEnd - time.navigationStart < 0 ? 0 : time.responseEnd - time.navigationStart,
                domloadend: time.domComplete - time.domLoading < 0 ? 0 : time.domComplete - time.domLoading,
                domative: time.domInteractive - time.domLoading < 0 ? 0 : time.domInteractive - time.domLoading,
                shelllod: time.domContentLoadedEventEnd - time.domContentLoadedEventStart < 0 ? 0 : time.domContentLoadedEventEnd - time.domContentLoadedEventStart,
                blankTime: time.domLoading - time.fetchStart < 0 ? 0 : time.domLoading - time.fetchStart,
                entryList: this.getPerformanceTimingEntry(),
                v: 'v1',
            };
            return data
        }
        return {}
    },

    sleep(time = 100) {
        return new Promise(resolve => setTimeout(resolve, time));
    }
};

export default Utils;

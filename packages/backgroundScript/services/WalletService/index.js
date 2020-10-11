import Logger from '@tronmask/lib/logger';
import EventEmitter from 'eventemitter3';
import StorageService from '../StorageService';
import NodeService from '../NodeService';
import Account from './Account';
import axios from 'axios';
import extensionizer from 'extensionizer';
import Utils from '@tronmask/lib/utils';
import TronWeb from 'tronweb';
import { BigNumber } from 'bignumber.js';
import {
    get as lodashGet,
    keys as lodashKeys,
    size as lodashSize,
    round as lodashRound,
    isEqual as lodashIsEqual,
    find as lodashFind
} from 'lodash';

import {
    APP_STATE,
    ACCOUNT_TYPE,
    mainNetList,
} from '@tronmask/lib/constants';

const logger = new Logger('WalletService');

class Wallet extends EventEmitter {
    constructor() {
        super();

        this.state = APP_STATE.UNINITIALISED;
        this.selectedAccount = false;
        this.isConfirming = false;
        this.popup = false;
        this.accounts = {};
        this.appWhitelist = {};      // sign white list for string limit some website
        this.phishingList = [];      // dapp phishing list (if it doesn't exit on the list the website will jump a phishing page for risk warning)
        this.confirmations = [];
        this.timer = {};
        this.otherTimer = {};
        this.notifyTimer = {};
        this.vTokenList = []; //add v icon in the  token list
        // This should be moved into its own component
        this.shouldPoll = false;
        this._checkStorage(); //change store by judge
        setInterval(() => {
            this.setCache();
        }, 30 * 60 * 1000);

        this.on('acceptConfirmation', () => {
            this.pushMessageTransaction()
        })
    }

    async _checkStorage() {
        if (await StorageService.dataExists() || StorageService.needsMigrating) {
            this._setState(APP_STATE.PASSWORD_SET);
        } // initstatus APP_STATE.PASSWORD_SET
    }

    migrate(password) {
        if (!StorageService.needsMigrating) {
            logger.info('No migration required');
            return false;
        }

        StorageService.authenticate(password);

        const {
            error = false,
            accounts,
            selectedAccount
        } = StorageService.migrate();

        if (error) {
            return false;
        }

        localStorage.setItem('TronLink_WALLET.bak', localStorage.getItem('TronLink_WALLET'));
        localStorage.removeItem('TronLink_WALLET');

        accounts.forEach(account => (
            this.importAccount(account)
        ));

        this.selectAccount(selectedAccount);

        // Force "Reboot" TronMask
        this.state = APP_STATE.PASSWORD_SET;
        StorageService.ready = false;

        this.unlockWallet(StorageService.password);

        return true;
    }

    _setState(appState) {
        if (this.state === appState) {
            return;
        }

        logger.info(`Setting app state to ${appState}`);

        this.state = appState;
        this.emit('newState', appState);

        return appState;
    }

    _loadAccounts() {
        const accounts = StorageService.getAccounts();
        const selected = StorageService.selectedAccount;

        const currentAccount = accounts[selected];
        logger.info('currentAccount:', currentAccount)
        if(lodashSize(currentAccount) > 0){
            const accountObj = new Account(
                currentAccount.type,
                currentAccount.mnemonic || currentAccount.privateKey || currentAccount.address,
                currentAccount.accountIndex
            );
            accountObj.update([], [], 0);
            this.accounts[selected] = accountObj;
        }
        Object.entries(accounts).forEach(([address, account]) => {
            if(address !== selected){
                const accountObj = new Account(
                    account.type,
                    account.mnemonic || account.privateKey || account.address,
                    account.accountIndex
                );
                accountObj.update([], [], 0);
                this.accounts[address] = accountObj;
            }
        });

        this.selectedAccount = selected;
        this.pushMessageTransaction();
        this.emit('setAccounts', this.getAccounts())
    }

    async _pollAccounts() {
        this._pollCurrentAccount()
        this._pollOtherAccounts()
    }

    async _pollCurrentAccount(){
        clearTimeout(this.timer);
        if (!this.shouldPoll) {
            logger.info('CurrentAccount Stopped polling');
            return;
        }

        const account = this.accounts[this.selectedAccount];
        if(account && account instanceof Account){
            account.update().then(() => {
                this.emit('setAccount', this.selectedAccount);
            }).catch(e => {
                logger.error(`update account ${account.address} fail`, e);
            });
            this.emit('setAccounts', this.getAccounts());
        }
        this.timer = setTimeout(() => {
            this._pollCurrentAccount();
        }, 10000);
    }

    async _pollOtherAccounts(){
        clearTimeout(this.otherTimer);

        if (!this.shouldPoll) {
            logger.info('OtherAccounts Stopped polling');
            return;
        }

        const accounts = Object.values(this.accounts);
        if (accounts.length > 0) {
            for (const account of accounts) {
                if (account.address !== this.selectedAccount) {
                    await account.update();
                }
            }
            this.emit('setAccounts', this.getAccounts());
        }
        this.otherTimer = setTimeout(() => {
            this._pollOtherAccounts();
        }, 35000);
    }

    async _updateWindow() {
        return new Promise(resolve => {
            if (typeof chrome !== 'undefined') {
                return extensionizer.windows.update(this.popup.id, { focused: true }, window => {
                    resolve(!!window);
                });
            }

            extensionizer.windows.update(this.popup.id, {
                focused: true
            }).then(resolve).catch(() => resolve(false));
        });
    }

    async _openPopup() {
        if (this.popup && this.popup.closed) {
            this.popup = false;
        }

        if (this.popup && await this._updateWindow()) {
            return;
        }

        if (typeof chrome !== 'undefined') {
            return extensionizer.windows.create({
                url: 'packages/popup/build/index.html',
                type: 'popup',
                width: 360,
                height: 625,
                left: 25,
                top: 25
            }, window => this.popup = window);
        }

        this.popup = await extensionizer.windows.create({
            url: 'packages/popup/build/index.html',
            type: 'popup',
            width: 360,
            height: 625,
            left: 25,
            top: 25
        });
    }

    _closePopup() {
        if (this.confirmations.length) {
            return;
        }

        if (!this.popup) {
            return;
        }

        extensionizer.windows.remove(this.popup.id);
        this.popup = false;
    }

    startPolling() {

        logger.info('Started polling');

        this.shouldPoll = true;
        this._pollAccounts();
    }

    stopPolling() {
        this.shouldPoll = false;
    }

    async refresh() {
        this.setCache();
        let res;
        const accounts = Object.values(this.accounts);
        for (const account of accounts) {
            if (account.address === this.selectedAccount) {
                this.pushMessageTransaction()
                const r = await account.update().catch(e => false);
                if (r) {
                    res = true;
                    this.emit('setAccount', this.selectedAccount);
                } else {
                    res = false;
                }
            } else {
                continue;
            }
        }
        this.emit('setAccounts', this.getAccounts());
        return res;
    }

    changeState(appState) {
        const stateAry = [
            APP_STATE.PASSWORD_SET,
            APP_STATE.RESTORING,
            APP_STATE.CREATING,
            APP_STATE.SETTING,
            APP_STATE.READY,
            APP_STATE.ASSET_MANAGE,
            APP_STATE.DAPP_WHITELIST,
            APP_STATE.NODE_MANAGE,
            // APP_STATE.TRANSFER,
            APP_STATE.ADDRESS_BOOK,
            APP_STATE.ADDRESS_BOOK_DETAIL,
            APP_STATE.EXPORT_ACCOUNT,
        ];
        if (!stateAry.includes(appState)) {
            return logger.error(`Attempted to change app state to ${appState}. Only 'restoring' and 'creating' is permitted`);
        }

        this._setState(appState);
    }

    async resetState() {
        logger.info('Resetting app state');

        if (!await StorageService.dataExists()) {
            return this._setState(APP_STATE.UNINITIALISED);
        }

        if (!StorageService.hasAccounts && !StorageService.ready) {
            return this._setState(APP_STATE.PASSWORD_SET);
        }

        if (!StorageService.hasAccounts && StorageService.ready) {
            return this._setState(APP_STATE.UNLOCKED);
        }

        if (StorageService.needsMigrating) {
            return this._setState(APP_STATE.MIGRATING);
        }

        if (this.state === APP_STATE.REQUESTING_CONFIRMATION && this.confirmations.length) {
            return;
        }

        this._setState(APP_STATE.READY);
    }

    // We shouldn't handle requests directly in WalletService.
    setPassword(password) {
        if (this.state !== APP_STATE.UNINITIALISED) {
            return Promise.reject('ERRORS.ALREADY_INITIALISED');
        }

        StorageService.authenticate(password);
        StorageService.save();
        NodeService.save();


        logger.info('User has set a password');
        this._setState(APP_STATE.UNLOCKED);

        const node = NodeService.getCurrentNode();

        this.emit('setNode', {
            node: {
                fullNode: node.fullNode,
                solidityNode: node.solidityNode,
                eventServer: node.eventServer
            }
        });
    }

    async unlockWallet(password) {
        if (this.state !== APP_STATE.PASSWORD_SET) {
            logger.error('Attempted to unlock wallet whilst not in PASSWORD_SET state');
            return Promise.reject('ERRORS.NOT_LOCKED');
        }

        if (StorageService.needsMigrating) {
            const success = this.migrate(password);

            if (!success) {
                return Promise.reject('ERRORS.INVALID_PASSWORD');
            }

            return;
        }

        const unlockFailed = await StorageService.unlock(password);
        if (unlockFailed) {
            logger.error(`Failed to unlock wallet: ${unlockFailed}`);
            return Promise.reject(unlockFailed);
        }

        if (!StorageService.hasAccounts) {
            logger.info('Wallet does not have any accounts');
            return this._setState(APP_STATE.UNLOCKED);
        }

        NodeService.init();

        this._loadAccounts();
        const selected = NodeService.getNodes().selected;
        // Bandage fix to change old ANTE to new ANTE
        Object.keys(this.accounts).forEach(address => {
            const account = this.accounts[address];
            const tokens = account.tokens[selected];

            const oldAddress = 'TBHN6guS6ztVVXbFivajdG3PxFUZ5UXGxY';
            const newAddress = 'TCN77KWWyUyi2A4Cu7vrh5dnmRyvUuME1E';

            if (!tokens.hasOwnProperty(oldAddress)) {
                return;
            }

            tokens[newAddress] = tokens[oldAddress];
            delete tokens[oldAddress];
        });
        const node = NodeService.getCurrentNode();
        const nodes = NodeService.getNodes();
        const connectNode = nodes.nodes[node.connect];
        if (!connectNode) {
            this.emit('setNode', {
                node: {
                    fullNode: node.fullNode,
                    solidityNode: node.solidityNode,
                    eventServer: node.eventServer,
                    chain: node.chain
                }
            });
        } else {
            this.emit('setNode', {
                    node: {
                        fullNode: node.fullNode,
                        solidityNode: node.solidityNode,
                        eventServer: node.eventServer,
                        chain: node.chain
                    },
                    connectNode: {
                        fullNode: connectNode.fullNode,
                        solidityNode: connectNode.solidityNode,
                        eventServer: connectNode.eventServer,
                        chain: connectNode.chain
                    }
                }
            );
        }
        this.emit('setAccount', this.selectedAccount);
        const setting = this.getSetting();
        setting.lock.lockTime = new Date().getTime();
        this.setSetting(setting);
        if (this.confirmations.length === 0) {
            await this.setCache();
            this._setState(APP_STATE.READY);
        } else {
            this._setState(APP_STATE.REQUESTING_CONFIRMATION);
        }
    }

    async lockWallet() {
        StorageService.lock();
        this.accounts = {};
        this.selectedAccount = false;
        for (const key in this.appWhitelist) {
            if (this.appWhitelist.hasOwnProperty(key)) {
                const duration = this.appWhitelist[key].duration;
                if (duration === -1) { // next login
                    delete this.appWhitelist[key];
                }
            }
        }
        this.emit('setAccount', this.selectedAccount);
        this._setState(APP_STATE.PASSWORD_SET);
    }

    queueConfirmation(confirmation, uuid, callback) {
        this.confirmations.push({
            confirmation,
            callback,
            uuid
        });

        if (this.state !== APP_STATE.REQUESTING_CONFIRMATION) {
            this._setState(APP_STATE.REQUESTING_CONFIRMATION);
        }

        logger.info('Added confirmation to queue', confirmation);

        this.emit('setConfirmations', this.confirmations);
        this._openPopup();
    }

    whitelistContract(confirmation, duration) {
        const {
            input: {
                contract_address: address
            },
            contractType,
            hostname
        } = confirmation;

        if (!this.appWhitelist[hostname]) {
            this.appWhitelist[hostname] = {};
        }
        this.appWhitelist[hostname].duration = duration < 0 ? duration : Date.now() + duration;

        if (contractType !== 'TriggerSmartContract') {
            logger.info(`Added auto sign on host ${hostname} with duration ${duration} to whitelist`);

        } else {
            logger.info(`Added contact ${address} on host ${hostname} with duration ${duration} to whitelist`);

        }

        this.acceptConfirmation({});
    }

    acceptConfirmation({ whitelistDuration, signedTransaction } = {}) {
        if (!this.confirmations.length) {
            return Promise.reject('NO_CONFIRMATIONS');
        }

        if (this.isConfirming) {
            return Promise.reject('ALREADY_CONFIRMING');
        }

        this.isConfirming = true;

        const {
            confirmation,
            callback,
            uuid
        } = this.confirmations.pop();
        // ledger support
        if (signedTransaction) {
            confirmation.signedTransaction = signedTransaction;
        }

        logger.info('acceptConfirmation: ', whitelistDuration, signedTransaction);

        if (whitelistDuration !== false && whitelistDuration !== -2) { // -2: perpetual license
            this.whitelistContract(confirmation, whitelistDuration);
        }

        callback({
            success: true,
            data: confirmation.signedTransaction,
            uuid
        });

        // record queue
        this.addTransactionToLocal(confirmation.signedTransaction);
        this.emit('acceptConfirmation', confirmation);

        this.isConfirming = false;
        if (this.confirmations.length) {
            this.emit('setConfirmations', this.confirmations);
        }
        this._closePopup();
        this.resetState();
    }

    rejectConfirmation() {
        if (this.isConfirming) {
            return Promise.reject('ALREADY_CONFIRMING');
        }

        this.isConfirming = true;

        const {
            confirmation,
            callback,
            uuid
        } = this.confirmations.pop();

        callback({
            success: false,
            data: 'Confirmation declined by user',
            uuid
        });

        this.isConfirming = false;
        if (this.confirmations.length) {
            this.emit('setConfirmations', this.confirmations);
        }
        this._closePopup();
        this.resetState();
    }

    /**
     *
     * @param mnemonic
     * @param name
     * @returns {Promise.<boolean>} create an account with mnemonic after confirming by generated mnemonic
     */

    async addAccount({ mnemonic, name, index = 0 }) {

        logger.info(`Adding account '${name}' from popup`);
        if (Object.keys(this.accounts).length === 0) {
            this.setCache();
        }

        const account = new Account(
            ACCOUNT_TYPE.MNEMONIC,
            mnemonic,
            index
        );

        const {
            address
        } = account;

        account.name = name;

        this.accounts[address] = account;
        StorageService.saveAccount(account);

        this.emit('setAccounts', this.getAccounts());
        this.selectAccount(address);
        // this._updateConfigResource();
        setTimeout(() => {
            this.refresh();
        }, 0);

        return true;
    }

    // This and the above func should be merged into one
    /**
     *
     * @param privateKey
     * @param name
     * @returns {Promise.<boolean>}
     */

    async importAccount({ privateKey, name, index = 0 }) {

        logger.info(`Importing account '${name}' from popup`);

        const account = new Account(
            privateKey.match(/^T/) && TronWeb.isAddress(privateKey) ? ACCOUNT_TYPE.LEDGER : ACCOUNT_TYPE.PRIVATE_KEY,
            privateKey,
            index
        );

        const {
            address
        } = account;

        account.name = name;
        if (Object.keys(this.accounts).length === 0) {
            this.setCache();
        }
        this.accounts[address] = account;
        StorageService.saveAccount(account);

        this.emit('setAccounts', this.getAccounts());
        this.selectAccount(address);
        setTimeout(() => {
            this.refresh();
        }, 0);

        return true;
    }

    async setCache() {
        const selected = NodeService.getNodes().selected;
        if (!mainNetList.includes(selected)) {
            return;
        }

        const trc10tokens = axios.get('https://apilist.tronscan.org/api/token?showAll=1&limit=4000&fields=tokenID,name,precision,abbr,imgUrl,isBlack');
        const trc20tokens = axios.get('https://apilist.tronscan.org/api/tokens/overview?start=0&limit=1000&filter=trc20');
        const trc20tokens_s = axios.get('https://dappchainapi.tronscan.org/api/tokens/overview?start=0&limit=1000&filter=trc20');
        Promise.all([trc10tokens, trc20tokens, trc20tokens_s]).then(res => {
            let t = [];
            let t2 = [];
            res[0].data.data.concat(res[1].data.tokens).forEach(({ abbr, name, imgUrl = false, tokenID = false, contractAddress = false, decimal = false, precision = false, isBlack = false }) => {
                t.push({
                    tokenId: tokenID ? tokenID.toString() : contractAddress,
                    abbr,
                    name,
                    imgUrl,
                    decimals: precision || decimal || 0,
                    isBlack
                });
            });
            res[0].data.data.concat(res[2].data.tokens).forEach(({ abbr, name, imgUrl = false, tokenID = false, contractAddress = false, decimal = false, precision = false, isBlack = false }) => {
                t2.push({
                    tokenId: tokenID ? tokenID.toString() : contractAddress,
                    abbr,
                    name,
                    imgUrl,
                    decimals: precision || decimal || 0,
                    isBlack
                });
            });
            StorageService.saveAllTokens(t, t2);
        }).catch(e => {
            logger.error('update Token error:', e)
        });
    }

    selectAccount(address) {
        StorageService.selectAccount(address);
        NodeService.setAddress();
        this.selectedAccount = address;
        this.pushMessageTransaction();
        this.emit('setAccount', address);
    }

    async selectNode(nodeID) {
        NodeService.selectNode(nodeID);

        Object.values(this.accounts).forEach(account => {
            account.reset();
            account.loadCache();
        });

        const node = NodeService.getCurrentNode();
        NodeService.selectChain(node.chain);
        const nodes = NodeService.getNodes();

        const connectNode = nodes.nodes[nodes.nodes[nodeID].connect];
        if (!connectNode) {

            this.emit('setNode', {
                node: {
                    fullNode: node.fullNode,
                    solidityNode: node.solidityNode,
                    eventServer: node.eventServer,
                    chain: node.chain
                }
            });
        } else {

            this.emit('setNode', {
                    node: {
                        fullNode: node.fullNode,
                        solidityNode: node.solidityNode,
                        eventServer: node.eventServer,
                        chain: node.chain
                    },
                    connectNode: {
                        fullNode: connectNode.fullNode,
                        solidityNode: connectNode.solidityNode,
                        eventServer: connectNode.eventServer,
                        chain: connectNode.chain
                    }
                }
            );
        }
        this.emit('setAccounts', this.getAccounts());
        this.emit('setAccount', this.selectedAccount);
        this.setCache();
        this.pushMessageTransaction()
    }

    async selectChain(chainId) {
        if (StorageService.chains.selectedChain !== chainId) {
            const chains = NodeService.getChains();
            const nodes = NodeService.getNodes();
            const node = Object.entries(nodes.nodes).filter(([nodeId, node]) => node.chain === chainId && node.default)[0];
            await this.selectNode(node[0]);
            NodeService.selectChain(chainId);
            chains.selected = chainId;
            this.emit('setChain', chains);
            this.setCache();
        }
    }

    addNode(node) {
        NodeService.addNode(node);
    }

    deleteNode(nodeId) {
        const id = NodeService.deleteNode(nodeId);
        id ? this.selectNode(id) : null;
    }

    getAccounts(sideChain = false) {
        const selected = NodeService.getNodes().selected;
        const accounts = Object.entries(this.accounts).reduce((accounts, [address, account]) => {
            if (sideChain && account.type === ACCOUNT_TYPE.LEDGER) {
                return;
            }

            accounts[address] = {
                name: account.name,
                balance: account.balance + account.frozenBalance,
                energyUsed: account.energyUsed,
                totalEnergyWeight: account.totalEnergyWeight,
                TotalEnergyLimit: account.TotalEnergyLimit,
                energy: account.energy,
                netUsed: account.netUsed,
                netLimit: account.netLimit,
                NetUsedOnly: account.NetUsedOnly,
                tokenCount: lodashSize(lodashGet(account.tokens, selected + '.basic')) + lodashSize(lodashGet(account.tokens, selected + '.smart')),
                type: account.type,
                frozenBalance: account.frozenBalance,
                accountIndex: account.accountIndex || 0,
            };

            return accounts;
        }, {});

        return accounts;
    }

    setSelectedToken(token) {
        StorageService.setSelectedToken(token);
        this.emit('setSelectedToken', token);
    }

    getSelectedToken() {
        return JSON.stringify(StorageService.selectedToken) === '{}' ? {
            id: '_',
            name: 'TRX',
            abbr: 'trx',
            amount: 0,
            decimals: 6
        } : StorageService.selectedToken;
    }

    setLanguage(language) {
        StorageService.setLanguage(language);
        localStorage.setItem('la', language);
        this.emit('setLanguage', language);
    }

    setSetting(setting) {
        StorageService.setSetting(setting);
        this.emit('setSetting', setting);
    }

    getLanguage() {
        return StorageService.language || localStorage.getItem('la');
    }

    getSetting() {
        return StorageService.getSetting();
    }

    getAccountDetails(address) {
        if (!address) {
            return {
                tokens: {
                    basic: {},
                    smart: {}
                },
                type: false,
                name: false,
                address: false,
                balance: 0,
                transactions: {
                    cached: [],
                    uncached: 0
                }
            };
        }

        return this.accounts[address].getDetails();
    }

    getSelectedAccount() {
        if (!this.selectedAccount) {
            return false;
        }

        return this.getAccountDetails(this.selectedAccount);
    }

    getAccount(address) {
        return this.accounts[address];
    }

    deleteAccount() {
        delete this.accounts[this.selectedAccount];
        StorageService.deleteAccount(this.selectedAccount);

        this.emit('setAccounts', this.getAccounts());

        if (!Object.keys(this.accounts).length) {
            this.selectAccount(false);
            return this._setState(APP_STATE.UNLOCKED);
        }

        this.selectAccount(Object.keys(this.accounts)[0]);
    }

    getConfirmations() {
        return this.confirmations;
    }

    async sendTrx({ recipient, amount, note }) {
        return await this.accounts[this.selectedAccount].sendTrx(
            recipient,
            amount,
            note
        );
    }

    async sendBasicToken({ recipient, amount, token, note }) {
        return await this.accounts[this.selectedAccount].sendBasicToken(
            recipient,
            amount,
            token,
            note
        );
    }

    async sendSmartToken({ recipient, amount, token, note }) {
        return await this.accounts[this.selectedAccount].sendSmartToken(
            recipient,
            amount,
            token,
            note
        );
    }

    //setting bank record id

    exportAccount() {
        const {
            mnemonic,
            privateKey
        } = this.accounts[this.selectedAccount];

        return {
            mnemonic: mnemonic || false,
            privateKey
        };
    }

    async getAccountInfo(address) {
        if (!NodeService.sunWeb) {
            await NodeService.init();
        }
        return {
            mainchain: await NodeService.sunWeb.mainchain.trx.getUnconfirmedAccount(address),
            sidechain: await NodeService.sunWeb.sidechain.trx.getUnconfirmedAccount(address),
        };
    }

    updateTokens(tokens) {
        const selected = NodeService.getNodes().selected;
        this.accounts[this.selectedAccount].tokens[selected] = tokens;
        StorageService.saveAccount(this.accounts[this.selectedAccount]);
        this.emit('setAccount', this.selectedAccount);
    }

    getAllTokens(selectedChain = '_') {
        return StorageService.hasOwnProperty('allTokens') ? (selectedChain === '_' ? StorageService.allTokens.mainchain : StorageService.allTokens.sidechain) : {};
    }

    getAuthorizeDapps() {
        return StorageService.hasOwnProperty('authorizeDapps') ? StorageService.authorizeDapps : {};
    }

    setAuthorizeDapps(authorizeDapps) {
        StorageService.setAuthorizeDapps(authorizeDapps);
        this.emit('setAuthorizeDapps', authorizeDapps);
    }

    async getAbiCode(contract_address) {
        const contract = await NodeService.tronWeb.contract().at(contract_address);
        return contract.abi;
    }

    getVTokenList() {
        return StorageService.hasOwnProperty('vTokenList') ? StorageService.vTokenList : [];
    }

    async pushMessageTransaction(){
        clearTimeout(this.notifyTimer);
        const canNotify = await this.checkNotifyPermissionLevel();
        if(!canNotify){
            return
        }
        const tronWeb = NodeService._selectedChain === '_' ? NodeService.sunWeb.mainchain : NodeService.sunWeb.sidechain;
        const transactions =  this.accounts[this.selectedAccount].getTransaction();
        let again = false;
        const now = Date.now();
        for (let i = 0; i < transactions.length; i++) {
            const transaction = transactions[i];
            const { txID, timestamp, notify, failed } = transaction;
            if (notify || failed) {
                continue;
            }
            if (now - timestamp > 60000) {// check fail
                transaction.failed = true;
            } else {
                const transactionInfo = await tronWeb.trx.getTransaction(txID).catch(e => {
                });
                if (transactionInfo && transactionInfo.txID === txID) {
                    this.transactionNotify({
                        title: '交易上链啦',
                        message: `在tronscan查看${txID}`,
                        hash: txID
                    });
                    transaction.notify = true;
                    await Utils.sleep(1000);
                } else {
                    again = true;
                }
            }
            this.accounts[this.selectedAccount].updateTransaction(transaction);
        }
        this.accounts[this.selectedAccount].save();

        logger.info("pushMessageTransaction finished");

        if(again){
            this.notifyTimer = setTimeout(() => {
                this.pushMessageTransaction();
            }, 3000)
        }
    }

    checkNotifyPermissionLevel(){
        return new Promise(resolve => {
            extensionizer.notifications.getPermissionLevel((level) => {
                if (level === 'granted') {
                    resolve(true)
                }else{
                    resolve(false)
                }
            });
        })
    }

    transactionNotify({ iconUrl = 'packages/popup/static/icon.png', title, message, hash }) {
        const url = 'https://tronscan.io/#/transaction/' + hash;
        try{
            extensionizer.notifications.create(url, {
                type: 'basic',
                iconUrl: extensionizer.extension.getURL(iconUrl),
                title,
                message
            }, notifyId => {
                logger.info('notifyId:', notifyId)
                // callback
            });
            extensionizer.notifications.onClicked.addListener(notifyId => {
                window.open(url);
            });
        }catch (e) {
            logger.info("transactionNotify:", e)
        }
    }

    async depositTrx(amount) {
        return await this.accounts[this.selectedAccount].depositTrx(amount);
    }

    async withdrawTrx(amount) {
        return await this.accounts[this.selectedAccount].withdrawTrx(amount);

    }

    async depositTrc10({ id, amount }) {
        return await this.accounts[this.selectedAccount].depositTrc10(id, amount);
    }

    async withdrawTrc10({ id, amount }) {
        return await this.accounts[this.selectedAccount].withdrawTrc10(id, amount);

    }

    async depositTrc20({ contract_address, amount }) {
        return await this.accounts[this.selectedAccount].depositTrc20(contract_address, amount);

    }

    async withdrawTrc20({ contract_address, amount }) {
        return await this.accounts[this.selectedAccount].withdrawTrc20(contract_address, amount);

    }

    async updateAccountName({ name }) {
        let account = this.accounts[this.selectedAccount];
        if (account) {
            account.name = name;
            StorageService.saveAccount(account);
            this.emit('setAccounts', this.getAccounts());
            this.selectAccount(this.selectedAccount);
        }
        return true;
    }

    async authPassword(password) {
        return StorageService.password === password
    }

    async getTransactionDetail(hash) {
        const tronWeb = NodeService._selectedChain === '_' ? NodeService.sunWeb.mainchain : NodeService.sunWeb.sidechain;
        let transactionDetail = { hash };
        try {
            const transaction = await tronWeb.trx.getTransaction(hash);
            const transactionInfo = await tronWeb.trx.getUnconfirmedTransactionInfo(hash);
            const { blockNumber, blockTimeStamp, receipt = {} } = transactionInfo || {};
            let data = lodashGet(transaction, 'raw_data.data');
            if (data) {
                data = tronWeb.toUtf8(data);
            }
            const toAddress = tronWeb.address.fromHex(lodashGet(transaction, 'raw_data.contract[0].parameter.value.to_address') || '');
            const fromAddress = tronWeb.address.fromHex(lodashGet(transaction, 'raw_data.contract[0].parameter.value.owner_address') || '');
            const amount = lodashGet(transaction, 'raw_data.contract[0].parameter.value.amount');
            transactionDetail = Object.assign(transactionDetail, {
                block: blockNumber,
                timestamp: blockTimeStamp,
                remarks: data,
                toAddress,
                fromAddress,
                amount,
                receipt
            });
        } catch (e) {
            logger.error('getTransactionDetail error:', e);
        }
        return transactionDetail;
    }

    getWalletPassword() {
        return StorageService.getWalletPassword();
    }

    async getTokenById(address) {
        const tronWeb = NodeService._selectedChain === '_' ? NodeService.sunWeb.mainchain : NodeService.sunWeb.sidechain;
        let res;
        try{
            res = await tronWeb.trx.getTokenByID(address);
        }catch (e) {
            logger.error('getTokenById err:', address, e.message)
        }
        return res
    }

    addTransactionToLocal(transaction){
        this.accounts[this.selectedAccount].addTransaction(transaction)
    }

}

export default Wallet;

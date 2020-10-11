import StorageService from '../StorageService';
import TronWeb from 'tronweb';
import Logger from '@tronmask/lib/logger';
import Utils from '@tronmask/lib/utils';
import NodeService from '../NodeService';

import { BigNumber } from 'bignumber.js';
import { toString as lodashToString, get as lodashGet, size as lodashSize, find as lodashFind } from 'lodash';

import {
    ACCOUNT_TYPE,
    CONTRACT_ADDRESS,
    FEE,
    API_URL,
    REFER_ABI
} from '@tronmask/lib/constants';

BigNumber.config({ EXPONENTIAL_AT: [-20, 30] });
const logger = new Logger('WalletService/Account');

class Account {
    constructor(accountType, importData, accountIndex = 0) {
        this.type = accountType;
        this.accountIndex = accountIndex;
        this.address = false;
        this.name = false;
        this.energy = 0;
        this.energyUsed = 0;
        this.balance = 0;
        this.frozenBalance = 0;
        this.netUsed = 0;
        this.netLimit = 0;
        this.NetUsedOnly = 0;
        this.totalEnergyWeight = 0; //totalEnergyWeight
        this.TotalEnergyLimit = 0; //TotalEnergyLimit
        this.lastUpdated = 0;
        this.transactions = [];
        this.tokens = {};
        const selected = NodeService.getNodes().selected;
        this.tokens[selected] = {
            basic: {},
            smart: {}
        };
        if (accountType == ACCOUNT_TYPE.MNEMONIC) {
            this._importMnemonic(importData);
        } else {
            this._importPrivateKey(importData);
        }
        this.loadCache();
    }

    static generateAccount() {
        const mnemonic = Utils.generateMnemonic();

        return new Account(
            ACCOUNT_TYPE.MNEMONIC,
            mnemonic
        );
    }

    _importMnemonic(mnemonic) {
        if (!Utils.validateMnemonic(mnemonic)) {
            throw new Error('INVALID_MNEMONIC');
        }

        this.mnemonic = mnemonic;

        const {
            privateKey,
            address
        } = this.getAccountAtIndex(this.accountIndex);

        this.privateKey = privateKey;
        this.address = address;
    }

    _importPrivateKey(privateKey) {
        try {
            if (privateKey.match(/^T/) && TronWeb.isAddress(privateKey)) {
                this.privateKey = null;
                this.address = privateKey;
            } else {
                this.privateKey = privateKey;
                this.address = TronWeb.address.fromPrivateKey(privateKey);
            }
        } catch (ex) { // eslint-disable-line
            throw new Error('INVALID_PRIVATE_KEY');
        }
    }

    getAccountAtIndex(index = 0) {
        if (this.type !== ACCOUNT_TYPE.MNEMONIC) {
            throw new Error('Deriving account keys at a specific index requires a mnemonic account');
        }

        return Utils.getAccountAtIndex(
            this.mnemonic,
            index
        );
    }

    loadCache() {
        if (!StorageService.hasAccount(this.address)) {
            return logger.warn('Attempted to load cache for an account that does not exist');
        }

        const {
            type,
            name,
            balance,
            frozenBalance,
            totalEnergyWeight,
            TotalEnergyLimit,
            transactions,
            netLimit,
            NetUsedOnly,
            netUsed,
            energy,
            energyUsed,
            lastUpdated,
        } = StorageService.getAccount(this.address);
        let { tokens } = StorageService.getAccount(this.address);

        // Old TRC10 structure are no longer compatible
        //tokens.basic = {};

        // Remove old token transfers so they can be fetched again

        if (!tokens || tokens.hasOwnProperty('basic') || tokens.hasOwnProperty('smart')) {
            const selected = NodeService.getNodes().selected;
            tokens = {
                [selected]: {
                    basic: {},
                    smart: {}
                }
            };
        }

        this.type = type;
        this.name = name;
        this.balance = balance;
        this.frozenBalance = frozenBalance;
        this.totalEnergyWeight = totalEnergyWeight;
        this.TotalEnergyLimit = TotalEnergyLimit;
        this.transactions = transactions || [];
        this.tokens = tokens;
        this.energy = energy;
        this.energyUsed = energyUsed;
        this.netLimit = netLimit;
        this.NetUsedOnly = NetUsedOnly;
        this.netUsed = netUsed;
        this.lastUpdated = lastUpdated;
        this.hash = '';
    }

    matches(accountType, importData) {
        if (this.type !== accountType) {
            return false;
        }

        if (accountType == ACCOUNT_TYPE.MNEMONIC && this.mnemonic === importData) {
            return true;
        }

        if (accountType == ACCOUNT_TYPE.PRIVATE_KEY && this.privateKey === importData) {
            return true;
        }

        return false;
    }

    reset() {
        this.balance = 0;
        this.frozenBalance = 0;
        this.energy = 0;
        this.energyUsed = 0;
        this.netUsed = 0;
        this.transactions = [];
        this.netLimit = 0;
        this.NetUsedOnly = 0;

        /*
        Object.keys(this.tokens.smart).forEach(address => (
             this.tokens.smart[ address ].balance = 0
         ));
         */
        // this.tokens.smart = {};
        // this.tokens.basic = {};
        // const selected = NodeService.getNodes().selected;
        // this.tokens[selected] = {
        //     basic: {},
        //     smart: {}
        // };
    }

    /** update data of an account
     * basicTokenPriceList  trc10token price list(source from trxmarket)
     * smartTokenPriceList  trc20token price list(source from trxmarket)
     * usdtPrice            price of usdt
     **/
    async update() {
        if (!StorageService.allTokens[NodeService._selectedChain === '_' ? 'mainchain' : 'sidechain'].length) return;
        const selectedChain = NodeService._selectedChain;
        const { address } = this;

        const node = NodeService.getNodes().selected;

        try {
            if (!lodashGet(this.tokens, node)) {
                this.tokens[node] = {
                    basic: {},
                    smart: {}
                };
            }
            let aliasBasicTokes = lodashGet(this.tokens, node + '.basic') || {};
            let aliasSmartTokens = lodashGet(this.tokens, node + '.smart') || {};
            let account = NodeService._selectedChain === '_' ? await NodeService.tronWeb.trx.getUnconfirmedAccount(address) : await NodeService.sunWeb.sidechain.trx.getUnconfirmedAccount(address);
            let tronWeb = NodeService._selectedChain === '_' ? NodeService.tronWeb : NodeService.sunWeb.sidechain;
            if (!account.address) {
                logger.info(`Account ${address} does not exist on the network`);
                account = this.createEmptyAccountStructure(address);
            }
            const addSmartTokens = Object.entries(aliasSmartTokens).filter(([tokenId, token]) => !token.hasOwnProperty('abbr'));
            for (const [tokenId, token] of addSmartTokens) {
                try{
                    const contract = await tronWeb.contract(REFER_ABI, tokenId);
                    if (contract) {
                        let balance;
                        const number = await contract.balanceOf(address).call({ _isConstant: true });
                        if (number.balance) {
                            balance = new BigNumber(number.balance).toString();
                        } else {
                            balance = new BigNumber(number).toString();
                        }
                        if (typeof token.name === 'object' || (!token.decimals)) {
                            const token2 = await NodeService.getSmartToken(tokenId).catch(err => {
                                throw new Error(`get token ${tokenId} info fail`);
                            });
                            aliasSmartTokens[tokenId] = token2;
                        }
                        aliasSmartTokens[tokenId].balance = balance;
                    } else {
                        aliasSmartTokens[tokenId].balance = 0;
                    }
                }catch (e) {
                    continue
                }
                aliasSmartTokens[tokenId].isLocked = token.hasOwnProperty('isLocked') ? token.isLocked : false;
            }

            this.frozenBalance = (lodashGet(account, 'frozen[0].frozen_balance') || 0)
                + (lodashGet(account, 'account_resource.frozen_balance_for_energy.frozen_balance') || 0)
                + (lodashGet(account, 'delegated_frozen_balance_for_bandwidth') || 0)
                + (lodashGet(account, 'account_resource,delegated_frozen_balance_for_energy') || 0);
            this.balance = account.balance || 0;
            const filteredTokens = (account.assetV2 || []).filter(({ value }) => value >= 0);
            for (const { key, value } of filteredTokens) {
                let token = aliasBasicTokes[key] || false;
                if (Number(NodeService.getNodes().nodes[node].netType) === 0) {
                    if (StorageService.allTokens[NodeService._selectedChain === '_' ? 'mainchain' : 'sidechain'].filter(({ tokenId }) => tokenId === key).length === 0) return;
                    const {
                        name = 'TRX',
                        abbr = 'TRX',
                        decimals = 6,
                        imgUrl = false
                    } = StorageService.allTokens[NodeService._selectedChain === '_' ? 'mainchain' : 'sidechain'].filter(({ tokenId }) => tokenId === key)[0];
                    token = {
                        balance: 0,
                        name,
                        abbr,
                        decimals,
                        imgUrl,
                        isLocked: token.hasOwnProperty('isLocked') ? token.isLocked : false
                    };
                    aliasBasicTokes[key] = {
                        ...token,
                        balance: value
                    };
                } else {
                    if ((!token && !StorageService.tokenCache.hasOwnProperty(key))) {
                        await StorageService.cacheToken(key);
                    }
                    if (StorageService.tokenCache.hasOwnProperty(key)) {
                        const {
                            name,
                            abbr,
                            decimals,
                            imgUrl = false
                        } = StorageService.tokenCache[key];

                        token = {
                            balance: 0,
                            name,
                            abbr,
                            decimals,
                            imgUrl
                        };
                    }
                    aliasBasicTokes[key] = {
                        ...token,
                        balance: value,
                    };

                }
            }

            this.lastUpdated = Date.now();
            await Promise.all([
                this.updateBalance(),
            ]);
            logger.info(`Account ${address} successfully updated`);
            Object.keys(StorageService.getAccounts()).includes(this.address) && this.save();
        } catch (error) {
            logger.error(`update account ${this.address} fail`, error);
        }
        return true;
    }

    async updateBalance() {
        const { address } = this;
        const { EnergyLimit = 0, EnergyUsed = 0, freeNetLimit = 0, NetLimit = 0, freeNetUsed = 0, NetUsed = 0, TotalEnergyWeight, TotalEnergyLimit } = NodeService._selectedChain === '_' ? await NodeService.tronWeb.trx.getAccountResources(address) : await NodeService.sunWeb.sidechain.trx.getAccountResources(address);
        this.energy = EnergyLimit;
        this.energyUsed = EnergyUsed;
        this.netLimit = freeNetLimit + NetLimit;
        this.NetUsedOnly = NetUsed;
        this.netUsed = NetUsed + freeNetUsed;
        this.totalEnergyWeight = TotalEnergyWeight;
        this.TotalEnergyLimit = TotalEnergyLimit;
    }

    getDetails() {
        const selected = NodeService.getNodes().selected;
        return {
            tokens: lodashGet(this.tokens, selected) || { basic: {}, smart: {} },
            type: this.type,
            name: this.name,
            address: this.address,
            balance: this.balance,
            frozenBalance: this.frozenBalance,
            totalEnergyWeight: this.totalEnergyWeight,
            TotalEnergyLimit: this.TotalEnergyLimit,
            energy: this.energy,
            energyUsed: this.energyUsed,
            netLimit: this.netLimit,
            NetUsedOnly: this.NetUsedOnly,
            netUsed: this.netUsed,
            transactions: this.transactions,
            lastUpdated: this.lastUpdated,
            accountIndex: this.accountIndex || 0,
        };
    }

    export() {
        return JSON.stringify(this);
    }

    save() {
        StorageService.saveAccount(this);
    }

    async sign(transaction, tronWeb = NodeService.tronWeb) {

        if (!this.privateKey) {
            // return 'CREATION.LEDGER.ALERT.BODY';
            return await transaction;
        }
        const signedTransaction = tronWeb.trx.sign(
            transaction,
            this.privateKey
        );

        return await signedTransaction;
    }

    async multiSign(transaction, tronWeb = NodeService.tronWeb, permissionId) {
        if (!this.privateKey) {
            // return 'CREATION.LEDGER.ALERT.BODY';
            return await transaction;
        }
        const signedTransaction = tronWeb.trx.multiSign(
            transaction,
            this.privateKey,
            permissionId
        );

        return await signedTransaction;
    }

    async sendTrx(recipient, amount, note) {
        const selectedChain = NodeService._selectedChain;
        try {
            const noteHex = Buffer.from(lodashToString(note), 'utf8').toString('hex');
            if (selectedChain === '_') {
                const transaction = await NodeService.tronWeb.transactionBuilder.sendTrx(
                    recipient,
                    amount
                );
                const transactionWithNote = await NodeService.tronWeb.transactionBuilder.addUpdateData(transaction, noteHex, 'hex');
                await NodeService.tronWeb.trx.sendRawTransaction(
                    await this.sign(transactionWithNote)
                ).then(() => true).catch(err => Promise.reject(
                    'Failed to broadcast transaction'
                ));
                return Promise.resolve(transactionWithNote.txID);
            } else {
                const transaction = await NodeService.sunWeb.sidechain.transactionBuilder.sendTrx(
                    recipient,
                    amount
                );
                const transactionWithNote = await NodeService.sunWeb.sidechain.transactionBuilder.addUpdateData(transaction, noteHex, 'hex');
                let res = await NodeService.sunWeb.sidechain.trx.sendRawTransaction(
                    await NodeService.sunWeb.sidechain.trx.sign(transactionWithNote, this.privateKey)
                ).then(() => true).catch(err => Promise.reject(
                    'Failed to broadcast transaction'
                ));
                // const { transaction } = await NodeService.sunWeb.sidechain.trx.sendTransaction(recipient, amount, { privateKey: this.privateKey });
                return Promise.resolve(transactionWithNote.txID);
            }
        } catch (ex) {
            logger.error('Failed to send TRX:', ex);
            return Promise.reject(ex);
        }
    }

    async sendBasicToken(recipient, amount, token, note) {
        const selectedChain = NodeService._selectedChain;
        try {
            const noteHex = Buffer.from(lodashToString(note), 'utf8').toString('hex');
            if (selectedChain === '_') {
                const transaction = await NodeService.tronWeb.transactionBuilder.sendToken(
                    recipient,
                    amount,
                    token
                );
                const transactionWithNote = await NodeService.tronWeb.transactionBuilder.addUpdateData(transaction, noteHex, 'hex');

                await NodeService.tronWeb.trx.sendRawTransaction(
                    await this.sign(transactionWithNote)
                ).then(() => true).catch(err => Promise.reject(
                    'Failed to broadcast transaction'
                ));
                return Promise.resolve(transactionWithNote.txID);
            } else {
                const transaction = await NodeService.sunWeb.sidechain.transactionBuilder.sendToken(
                    recipient,
                    amount,
                    token
                );
                const transactionWithNote = await NodeService.sunWeb.sidechain.transactionBuilder.addUpdateData(transaction, noteHex, 'hex');
                await NodeService.sunWeb.sidechain.trx.sendRawTransaction(
                    await NodeService.sunWeb.sidechain.trx.sign(transactionWithNote, this.privateKey)
                ).then(() => true).catch(err => Promise.reject(
                    'Failed to broadcast transaction'
                ));
                // const { transaction } = await NodeService.sunWeb.sidechain.trx.sendToken(recipient, amount, token, { privateKey: this.privateKey });
                return Promise.resolve(transactionWithNote.txID);
            }
        } catch (ex) {
            logger.error('Failed to send basic token:', ex);
            return Promise.reject(ex);
        }
    }

    async sendSmartToken(recipient, amount, token, note) {
        const selectedChain = NodeService._selectedChain;
        try {
            const noteHex = Buffer.from(lodashToString(note), 'utf8').toString('hex');
            if (selectedChain === '_') {
                const { transaction } = await NodeService.tronWeb.transactionBuilder.triggerSmartContract(TronWeb.address.toHex(token), 'transfer(address,uint256)', { feeLimit: 10000000 }, [{
                    'type': 'address',
                    'value': recipient
                }, { 'type': 'uint256', 'value': amount }]);
                const transactionWithNote = await NodeService.tronWeb.transactionBuilder.addUpdateData(transaction, noteHex, 'hex');
                const signTransaction = await NodeService.tronWeb.trx.sign(transactionWithNote, this.privateKey);
                await NodeService.tronWeb.trx.sendRawTransaction(signTransaction);
                return Promise.resolve(transactionWithNote.txID);
            } else {
                const sidechain = NodeService.sunWeb.sidechain;
                const { transaction } = await NodeService.sunWeb.sidechain.transactionBuilder.triggerSmartContract(TronWeb.address.toHex(token), 'transfer(address,uint256)', { feeLimit: 1000000 }, [{
                    'type': 'address',
                    'value': recipient
                }, { 'type': 'uint256', 'value': amount }]);
                const transactionWithNote = await NodeService.sunWeb.sidechain.transactionBuilder.addUpdateData(transaction, noteHex, 'hex');
                const signTransaction = await sidechain.trx.sign(transactionWithNote, this.privateKey);
                await sidechain.trx.sendRawTransaction(signTransaction);
                return Promise.resolve(transactionWithNote.txID);
            }
        } catch (ex) {
            logger.error('Failed to send smart token:', ex);
            return Promise.reject(ex);
        }
    }

    async depositTrx(amount) {
        try {
            const txId = await NodeService.sunWeb.depositTrx(amount, FEE.DEPOSIT_FEE, FEE.FEE_LIMIT, {}, this.privateKey);
            return Promise.resolve(txId);
        } catch (ex) {
            logger.error('Failed to send TRX:', ex);
            return Promise.reject(ex);
        }
    }

    async withdrawTrx(amount) {
        try {
            const txId = await NodeService.sunWeb.withdrawTrx(amount, FEE.WITHDRAW_FEE, FEE.FEE_LIMIT, {}, this.privateKey);
            return Promise.resolve(txId);
        } catch (ex) {
            logger.error('Failed to send TRX:', ex);
            return Promise.reject(ex);
        }
    }

    async depositTrc10(id, amount) {
        try {
            const txId = await NodeService.sunWeb.depositTrc10(id, amount, FEE.DEPOSIT_FEE, FEE.FEE_LIMIT, {}, this.privateKey);
            return Promise.resolve(txId);
        } catch (ex) {
            logger.error('Failed to send TRX:', ex);
            return Promise.reject(ex);
        }
    }

    async withdrawTrc10(id, amount) {
        try {
            const txId = await NodeService.sunWeb.withdrawTrc10(id, amount, FEE.WITHDRAW_FEE, FEE.FEE_LIMIT, {}, this.privateKey);
            return Promise.resolve(txId);
        } catch (ex) {
            logger.error('Failed to send TRX:', ex);
            return Promise.reject(ex);
        }
    }

    async depositTrc20(id, amount) {
        try {
            const approve = await NodeService.sunWeb.approveTrc20(amount, FEE.FEE_LIMIT, id, {}, this.privateKey);
            if (approve) {
                const txId = await NodeService.sunWeb.depositTrc20(amount, FEE.DEPOSIT_FEE, FEE.FEE_LIMIT, id, {}, this.privateKey);
                return Promise.resolve(txId);
            } else {
                return Promise.resolve('failed');
            }
        } catch (ex) {
            logger.error('Failed to send TRX:', ex);
            return Promise.reject(ex);
        }
    }

    async withdrawTrc20(id, amount) {
        try {

            const txId = await NodeService.sunWeb.withdrawTrc20(amount, FEE.WITHDRAW_FEE, FEE.FEE_LIMIT, id, {}, this.privateKey);
            return Promise.resolve(txId);

        } catch (ex) {
            logger.error('Failed to send TRX:', ex);
            return Promise.reject(ex);
        }
    }

    createEmptyAccountStructure(address = '') {
        if (address) {
            address = TronWeb.address.toHex(address);
        }
        return {
            'address': address,
            'balance': 0,
            'create_time': 0,
            'latest_opration_time': 0,
            'free_net_usage': 0,
            'latest_consume_free_time': 0,
            'account_resource': {
                'frozen_balance_for_energy': { 'frozen_balance': 0, 'expire_time': 0 },
                'latest_consume_time_for_energy': 0
            }
        };
    }

    addTransaction(transaction) {
        const txID = lodashGet(transaction, 'txID');
        const signature = lodashGet(transaction, 'signature');
        const timestamp = lodashGet(transaction, 'raw_data.timestamp');
        const expiration = lodashGet(transaction, 'raw_data.expiration');
        const raw_data_hex = lodashGet(transaction, 'raw_data.raw_data_hex');
        const type = lodashGet(transaction, 'raw_data.contract[0].type');
        if (!transaction || !txID || !timestamp) {
            return;
        }
        if (lodashSize(this.transactions) >= 20) {
            this.transactions.shift();
        }
        this.transactions.push({
            txID,
            signature,
            timestamp,
            expiration,
            raw_data_hex,
            type,
            notify: false, // web桌面通知
            failed: false,
        });
    }

    getTransaction() {
        return this.transactions || [];
    }

    updateTransaction(transaction) {
        let info = lodashFind(this.transactions, o => {
            return o.txID === transaction.txID;
        });
        info.notify = !!transaction.notify;
        info.failed = !!transaction.failed;
    }

}

export default Account;

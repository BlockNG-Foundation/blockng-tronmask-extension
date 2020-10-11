import extensionizer from 'extensionizer';
import Logger from '@tronmask/lib/logger';
import Utils from '@tronmask/lib/utils';
import NodeService from '../NodeService';
import { get as lodashGet } from 'lodash';
const logger = new Logger('StorageService');

const StorageService = {
    // We could instead scope the data so we don't need this array
    storageKeys: [
        'accounts',
        'nodes',
        'transactions',
        'selectedAccount',
        'tokenCache',
        'setting',
        'language',
        'allTokens',
        'authorizeDapps',
        'vTokenList',
        'chains',
    ],

    storage: extensionizer.storage.local,
    nodes: {
        nodeList: {},
        selectedNode: false
    },
    chains: {
        chainList:{},
        selectedChain: false
    },
    accounts: {},
    transactions: {},
    tokenCache: {},
    selectedAccount: false,
    selectedToken: {},
    setting: {
        lock: {
            lockTime: 0,
            duration: 0
        },
        openAccountsMenu:false,
        advertising: {},
        developmentMode: location.hostname !== 'ibnejdfjmmkpcnlpebklmnkoeoihofec',
        showUpdateDescription:false
    },
    language: '',
    ready: false,
    password: false,
    allTokens : {
        mainchain: [],
        sidechain: []
    },
    allSideTokens : [],
    authorizeDapps: {},
    vTokenList: [],

    get needsMigrating() {
        return localStorage.hasOwnProperty('TronLink_WALLET');
    },

    get hasAccounts() {
        return Object.keys(this.accounts).length;
    },

    getStorage(key) {
        return new Promise(resolve => (
            this.storage.get(key, data => {
                if(key in data)
                    return resolve(data[ key ]);

                resolve(false);
            })
        ));
    },

    async dataExists() {
        return !!(await this.getStorage('accounts'));
    },

    lock() {
        this.ready = false;
    },

    async unlock(password) {
        if(this.ready) {
            logger.error('Attempted to decrypt data whilst already unencrypted');
            return 'ERRORS.ALREADY_UNLOCKED';
        }

        if(!await this.dataExists())
            return 'ERRORS.NOT_SETUP';

        try {
            for(let i = 0; i < this.storageKeys.length; i++) {
                const key = this.storageKeys[ i ];
                const encrypted = await this.getStorage(key);

                if(!encrypted)
                    continue;

                this[ key ] = Utils.decrypt(
                    encrypted,
                    password
                );
            }
        } catch(ex) {
            logger.warn('Failed to decrypt wallet (wrong password?):', ex);
            return 'ERRORS.INVALID_PASSWORD';
        }

        logger.info('Decrypted wallet data');

        this.password = password;
        this.ready = true;

        return false;
    },

    hasAccount(address) {
        // This is the most disgusting piece of code I've ever written.
        return (address in this.accounts);
    },

    selectAccount(address) {
        logger.info(`Storing selected account: ${ address }`);

        this.selectedAccount = address;
        this.save('selectedAccount');
    },

    getAccounts() {
        const accounts = {};

        const selected = NodeService.getNodes().selected;
        Object.keys(this.accounts).forEach(address => {
            accounts[ address ] = {
                transactions: lodashGet(this.transactions, `${address}.${selected}`) || [],
                ...this.accounts[ address ]
            };
        });

        return accounts;
    },

    getAccount(address) {
        const account = this.accounts[ address ];
        const selected = NodeService.getNodes().selected;
        const transactions = lodashGet(this.transactions, `${address}.${selected}`) || [];

        return {
            transactions,
            ...account
        };
    },

    deleteAccount(address) {
        logger.info('Deleting account', address);

        delete this.accounts[ address ];
        //delete this.transactions[ address ];
        //this.accounts = Object.entries(this.accounts).filter(([key,accounts])=>key !== address).reduce((accumulator, currentValue)=>{accumulator[currentValue[0]]=currentValue[1];return accumulator;},{});
        this.save('accounts');
    },

    deleteNode(nodeID) {
        logger.info('Deleting node', nodeID);

        delete this.nodes.nodeList[ nodeID ];
        this.save('nodes');
    },

    saveNode(nodeID, node) {
        logger.info('Saving node', node);

        this.nodes.nodeList[ nodeID ] = node;
        this.save('nodes');
    },

    saveChain(chainId ,chain) {
        logger.info('Saving chain', chain);

        this.chains.chainList[ chainId ] = chain;
        this.save('chains');
    },

    selectNode(nodeID) {
        logger.info('Saving selected node', nodeID);

        this.nodes.selectedNode = nodeID;
        this.save('nodes');
    },

    selectChain(chainID) {
        logger.info('Saving selected chain', chainID);

        this.chains.selectedChain = chainID;
        this.save('chains');
    },

    saveAccount(account) {
        logger.info('Saving account', account);

        const {
            transactions,
            ...remaining // eslint-disable-line
        } = account;

        const selected = NodeService.getNodes().selected;
        this.transactions[account.address] = this.transactions[account.address] || {};
        this.transactions[account.address][selected] = transactions;

        this.accounts[ account.address ] = remaining;

        this.save('transactions', 'accounts');
    },

    setSelectedToken(token) {
        logger.info('Saving selectedToken', token);
        this.selectedToken = token;
        this.save('selectedToken');
    },

    setLanguage(language){
        logger.info('Saving language', language);
        this.language = language;
        this.save('language');
    },

    setSetting(setting){
        logger.info('Saving setting', setting);
        this.setting = setting;
        this.save('setting');
    },

    getSetting(){
        if(!this.setting.hasOwnProperty('advertising')){
            this.setting.advertising = {};
        }
        if(!this.setting.hasOwnProperty('showUpdateDescription')){
            this.setting.showUpdateDescription = false;
        }
        return {...this.setting,developmentMode:location.hostname !== 'ibnejdfjmmkpcnlpebklmnkoeoihofec'};
    },

    migrate() {
        try {
            const storage = localStorage.getItem('TronLink_WALLET');
            const decrypted = Utils.decrypt(
                JSON.parse(storage),
                this.password
            );

            const {
                accounts,
                currentAccount
            } = decrypted;

            return {
                accounts: Object.values(accounts).map(({ privateKey, name }) => ({
                    privateKey,
                    name
                })),
                selectedAccount: currentAccount
            };
        } catch(ex) {
            logger.info('Failed to migrate (wrong password?):', ex);

            return {
                error: true
            };
        }
    },

    authenticate(password) {
        this.password = password;
        this.ready = true;

        logger.info('Set storage password');
    },


    save(...keys) {
        if(!this.ready)
            return logger.error('Attempted to write storage when not ready');

        if(!keys.length)
            keys = this.storageKeys;

        logger.info(`Writing storage for keys ${ keys.join(', ') }`);

        keys.forEach(key => (
            this.storage.set({
                [ key ]: Utils.encrypt(this[ key ], this.password)
            })
        ));

        logger.info('Storage saved');
    },

    /**
     *
     * @param tokenID
     * @returns {Promise.<void>}
     * get token  name,abbr,precision and cache the token (only called this function in shast environment)
     */

    async cacheToken(tokenID) {


        const {
            name,
            abbr,
            precision: decimals = 0
        } = NodeService._selectedChain === '_' ? await NodeService.tronWeb.trx.getTokenFromID(tokenID) : await NodeService.sunWeb.sidechain.trx.getTokenFromID(tokenID);
        this.tokenCache[ tokenID ] = {
            name,
            abbr,
            decimals
        };


        logger.info(`Cached token ${ tokenID }:`, this.tokenCache[ tokenID ]);

        this.save('tokenCache');
    },

    saveAllTokens(tokens,tokens2) {
        this.allTokens.mainchain = tokens;
        this.allTokens.sidechain = tokens2;
        this.save('allTokens');
    },

    setAuthorizeDapps(authorizeDapps) {
        this.authorizeDapps = authorizeDapps;
        this.save('authorizeDapps');
    },

    saveVTokenList(vTokenList){
        this.vTokenList = vTokenList;
        this.save('vTokenList');
    },

    purge() {
        logger.warn('Purging TronMask. This will remove all stored transaction data');

        this.storage.set({
            transactions: Utils.encrypt({}, this.password)
        });

        logger.info('Purge complete. Please reload TronMask');
    },

    getWalletPassword() {
        return this.password;
    },
};

export default StorageService;

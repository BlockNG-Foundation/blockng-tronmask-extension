import Logger from '@tronmask/lib/logger';
import MessageDuplex from '@tronmask/lib/MessageDuplex';
import NodeService from './services/NodeService';
import StorageService from './services/StorageService';
import WalletService from './services/WalletService';
import Utils from '@tronmask/lib/utils';
import transactionBuilder from '@tronmask/lib/transactionBuilder';
import TronWeb from 'tronweb';
import { get as lodashGet } from 'lodash';


import { CONFIRMATION_TYPE } from '@tronmask/lib/constants';
import { BackgroundAPI } from '@tronmask/lib/api';


const duplex = new MessageDuplex.Host();
const logger = new Logger('backgroundScript');

const backgroundScript = {
    walletService: Utils.requestHandler(
        new WalletService()
    ),

    nodeService: Utils.requestHandler(NodeService),

    run() {
        BackgroundAPI.init(duplex);

        this.bindPopupDuplex();
        this.bindTabDuplex();
        this.bindWalletEvents();
    },

    bindPopupDuplex() {
        // Popup Handling (For transaction polling)
        duplex.on('popup:connect', () => (
            this.walletService.startPolling()
        ));

        duplex.on('popup:disconnect', () => (
            this.walletService.stopPolling()
        ));

        //refresh the wallet data
        duplex.on('refresh', this.walletService.refresh);

        // Getter methods
        duplex.on('requestState', ({ resolve }) => resolve(
            this.walletService.state
        ));

        //get the transaction records of token that need to selected
        duplex.on('setSelectedToken', this.walletService.setSelectedToken);
        duplex.on('getSelectedToken', this.walletService.getSelectedToken);

        // WalletService: Confirmation responses
        duplex.on('acceptConfirmation', this.walletService.acceptConfirmation);
        duplex.on('rejectConfirmation', this.walletService.rejectConfirmation);

        // WalletService: Blockchain actions
        duplex.on('sendTrx', this.walletService.sendTrx);
        duplex.on('sendBasicToken', this.walletService.sendBasicToken);
        duplex.on('sendSmartToken', this.walletService.sendSmartToken);

        // WalletService: Account management / migration
        duplex.on('addAccount', this.walletService.addAccount);
        duplex.on('selectAccount', this.walletService.selectAccount);
        duplex.on('getAccountDetails', this.walletService.getAccountDetails);
        duplex.on('getAccounts', this.walletService.getAccounts);
        duplex.on('importAccount', this.walletService.importAccount);
        duplex.on('getSelectedAccount', this.walletService.getSelectedAccount);
        duplex.on('getConfirmations', this.walletService.getConfirmations);
        duplex.on('deleteAccount', this.walletService.deleteAccount);
        duplex.on('exportAccount', this.walletService.exportAccount);
        duplex.on('updateAccountName', this.walletService.updateAccountName);

        // WalletService: State management
        duplex.on('changeState', this.walletService.changeState);
        duplex.on('resetState', this.walletService.resetState);

        // WalletService: Authentication
        duplex.on('setPassword', this.walletService.setPassword);
        duplex.on('unlockWallet', this.walletService.unlockWallet);
        duplex.on('lockWallet', this.walletService.lockWallet);

        // NodeService: Node management
        duplex.on('selectNode', this.walletService.selectNode);
        duplex.on('addNode', this.walletService.addNode);
        duplex.on('deleteNode', this.walletService.deleteNode);
        duplex.on('getNodes', this.nodeService.getNodes);

        duplex.on('getSmartToken', this.nodeService.getSmartToken);
        // chain
        duplex.on('getChains', this.nodeService.getChains);
        duplex.on('selectChain', this.walletService.selectChain);

        // language
        duplex.on('getLanguage', this.walletService.getLanguage);
        duplex.on('setLanguage', this.walletService.setLanguage);
        //setting
        duplex.on('getSetting', this.walletService.getSetting);
        duplex.on('setSetting', this.walletService.setSetting);

        duplex.on('getAccountInfo', this.walletService.getAccountInfo);

        duplex.on('updateTokens', this.walletService.updateTokens);
        duplex.on('getAllTokens', this.walletService.getAllTokens);

        duplex.on('setAuthorizeDapps', this.walletService.setAuthorizeDapps);
        duplex.on('getAuthorizeDapps', this.walletService.getAuthorizeDapps);


        duplex.on('getAbiCode', this.walletService.getAbiCode);
        duplex.on('getVTokenList', this.walletService.getVTokenList);

        // WalletService:deposit, withdraw
        duplex.on('depositTrx', this.walletService.depositTrx);
        duplex.on('withdrawTrx', this.walletService.withdrawTrx);

        duplex.on('depositTrc10', this.walletService.depositTrc10);
        duplex.on('withdrawTrc10', this.walletService.withdrawTrc10);

        duplex.on('depositTrc20', this.walletService.depositTrc20);
        duplex.on('withdrawTrc20', this.walletService.withdrawTrc20);

        //tokens
        duplex.on('getTokenById', this.walletService.getTokenById);

        //transaction
        duplex.on('getTransactionDetail', this.walletService.getTransactionDetail);
        // system
        duplex.on('getWalletPassword', this.walletService.getWalletPassword);
        duplex.on('authPassword', this.walletService.authPassword);
    },

    bindTabDuplex() {
        duplex.on('tabRequest', async ({ hostname, resolve, data: { action, data, uuid } }) => {
            // Abstract this so we can just do resolve(data) or reject(data)
            // and it will map to { success, data, uuid }
            switch (action) {
                case 'init': {
                    const response = {
                        address: false,
                        node: {
                            fullNode: false,
                            solidityNode: false,
                            eventServer: false
                        },
                        connectNode: false,
                        name: false,
                        type: false
                    };
                    if (StorageService.ready) {
                        const node = NodeService.getCurrentNode();
                        const { phishingList } = this.walletService;
                        response.node = {
                            ...node
                        };
                        if (node.connect) {
                            const nodes = NodeService.getNodes();
                            const connectNode = nodes.nodes[node.connect];
                            response.connectNode = { ...connectNode };
                        }
                        const { address, name, type } = this.walletService.accounts[this.walletService.selectedAccount] ? this.walletService.accounts[this.walletService.selectedAccount] : {
                            address: false,
                            name: false,
                            type: false
                        };
                        response.address = address;
                        response.name = name;
                        response.type = type;
                        response.phishingList = phishingList;
                    }

                    resolve({
                        success: true,
                        data: response,
                        uuid
                    });

                    break;
                }
                case 'sign': {
                    if (!this.walletService.selectedAccount) {
                        return resolve({
                            success: false,
                            data: 'User has not unlocked wallet',
                            uuid
                        });
                    }

                    try {
                        const {
                            transaction,
                            input
                        } = data;
                        // Judgment Visible.

                        const {
                            selectedAccount
                        } = this.walletService;

                        let tronWeb = NodeService.tronWeb;
                        let chainType = 0;
                        if (!!transaction && data.input.chainType == 1) {
                            chainType = data.input.chainType;
                            // tronWeb = NodeService.sunWeb.sidechain;
                        }
                        const account = this.walletService.getAccount(selectedAccount);
                        const appWhitelist = this.walletService.appWhitelist.hasOwnProperty(hostname) ? this.walletService.appWhitelist[hostname] : {};
                        const accountType = lodashGet(account, 'type');

                        if (typeof input === 'string') {
                            const { duration = 0 } = appWhitelist;
                            const signedTransaction = !!data.multiSign ? await account.multiSign(transaction, Number(chainType) === 1 ? NodeService.sunWeb.sidechain : NodeService.sunWeb.mainchain, data.permissionId) : await account.sign(input);
                            if (accountType !== 2 && appWhitelist && (duration === -1 || duration >= Date.now())) {
                                logger.info('Automatically signing transaction', signedTransaction);
                                return resolve({
                                    success: true,
                                    data: signedTransaction,
                                    uuid
                                });
                            }

                            const authorizeDapps = this.walletService.getAuthorizeDapps();
                            if (accountType !== 2 && authorizeDapps.hasOwnProperty(hostname)) {
                                logger.info('Automatically signing transaction', signedTransaction);
                                return resolve({
                                    success: true,
                                    data: signedTransaction,
                                    uuid
                                });
                            }

                            return this.walletService.queueConfirmation({
                                type: CONFIRMATION_TYPE.STRING,
                                hostname,
                                signedTransaction,
                                input
                            }, uuid, resolve);
                        }

                        let visible = lodashGet(transaction, 'visible');
                        if (Object.prototype.toString.call(visible).slice(8, -1) === 'String') {
                            visible = visible === 'true';
                        }
                        input.visible = !!visible;

                        const contractType = transaction.raw_data.contract[0].type;
                        const contractAddress = TronWeb.address.fromHex(input.contract_address);
                        const {
                            mapped,
                            error
                        } = !!data.multiSign && data.permissionId != undefined ? {
                            mapped: transaction,
                            error: null
                        } : await transactionBuilder(Number(chainType) === 1 ? NodeService.sunWeb.sidechain : NodeService.sunWeb.mainchain, contractType, input); // NodeService.getCurrentNode()
                        if (error) {
                            return resolve({
                                success: false,
                                data: 'Invalid transaction provided',
                                uuid
                            });
                        }
                        let signedTransaction = {};
                        if (!!data.multiSign && data.permissionId != undefined) {
                            signedTransaction = await account.multiSign(
                                mapped.transaction || mapped,
                                Number(chainType) === 1 ? NodeService.sunWeb.sidechain : NodeService.sunWeb.mainchain,
                                data.permissionId
                            );
                        } else {
                            let unSignedTransaction = mapped.transaction || mapped;
                            console.log('unSignedTransaction', mapped.transaction, mapped);
                            if (['TransferContract', 'TriggerSmartContract', 'TransferAssetContract'].indexOf(contractType) != -1 && transaction.raw_data.data) {
                                unSignedTransaction = await tronWeb.transactionBuilder.addUpdateData(unSignedTransaction, tronWeb.toUtf8(transaction.raw_data.data), 'utf8');
                            }
                            signedTransaction = await account.sign(
                                unSignedTransaction,
                                Number(chainType) === 1 ? NodeService.sunWeb.sidechain : NodeService.sunWeb.mainchain
                            );
                        }

                        //Data statistics
                        const value = input.call_value || 0;

                        if (contractType === 'TriggerSmartContract' && accountType !== 2 && appWhitelist) {
                            const { duration = 0 } = appWhitelist;
                            if (duration === -1 || duration >= Date.now()) {
                                logger.info('Automatically signing transaction', signedTransaction);

                                return resolve({
                                    success: true,
                                    data: signedTransaction,
                                    uuid
                                });
                            }
                        }

                        const authorizeDapps = this.walletService.getAuthorizeDapps();
                        if (contractType === 'TriggerSmartContract' && accountType !== 2 && authorizeDapps.hasOwnProperty(hostname)) {
                            logger.info('Automatically signing transaction', signedTransaction);

                            return resolve({
                                success: true,
                                data: signedTransaction,
                                uuid
                            });
                        }

                        this.walletService.queueConfirmation({
                            chainType,
                            type: CONFIRMATION_TYPE.TRANSACTION,
                            hostname,
                            signedTransaction,
                            contractType,
                            input
                        }, uuid, resolve);
                    } catch (ex) {
                        logger.error('Failed to sign transaction:', ex);

                        return resolve({
                            success: false,
                            data: 'Invalid transaction provided',
                            uuid
                        });
                    }
                    break;
                }
                case 'setVisited': {
                    const { href = '' } = data;
                    const phishingList = this.walletService.phishingList;
                    if (href) {
                        this.walletService.phishingList = phishingList.map(({ url, isVisit }) => {
                            const reg = new RegExp(url);
                            if (href.match(reg)) {
                                isVisit = true;
                            }
                            return { url, isVisit };
                        });
                    } else {
                        this.walletService.phishingList = phishingList.map(({ url, isVisit }) => {
                            isVisit = false;
                            return { url, isVisit };
                        });
                    }
                    resolve({
                        success: true,
                        data: '',
                        uuid
                    });
                    break;
                }
                default:
                    resolve({
                        success: false,
                        data: 'Unknown method called',
                        uuid
                    });
                    break;
            }
        });
    },

    bindWalletEvents() {
        this.walletService.on('newState', appState => (
            BackgroundAPI.setState(appState)
        ));

        this.walletService.on('setAccount', address => BackgroundAPI.setAccount(
            this.walletService.getAccountDetails(address)
        ));

        this.walletService.on('setNode', node => (
            BackgroundAPI.setNode(node)
        ));

        this.walletService.on('setChain', chain => (
            BackgroundAPI.setChain(chain)
        ));

        this.walletService.on('setAccounts', accounts => (
            BackgroundAPI.setAccounts(accounts)
        ));

        this.walletService.on('setConfirmations', confirmations => (
            BackgroundAPI.setConfirmations(confirmations)
        ));

        this.walletService.on('setPriceList', priceList => (
            BackgroundAPI.setPriceList(priceList)
        ));

        this.walletService.on('setCurrency', currency => (
            BackgroundAPI.setCurrency(currency)
        ));

        this.walletService.on('setSelectedToken', token => (
            BackgroundAPI.setSelectedToken(token)
        ));

        this.walletService.on('setLanguage', language => (
            BackgroundAPI.setLanguage(language)
        ));

        this.walletService.on('setSetting', setting => (
            BackgroundAPI.setSetting(setting)
        ));

        this.walletService.on('setAuthorizeDapps', authorizeDapps => (
            BackgroundAPI.setAuthorizeDapps(authorizeDapps)
        ));

        this.walletService.on('setVTokenList', vTokenList => (
            BackgroundAPI.setVTokenList(vTokenList)
        ));

        this.walletService.on('setResource', resource => (
            BackgroundAPI.setResource(resource)
        ));

        this.walletService.on('setNodes', nodes => (
            BackgroundAPI.setNodes(nodes)
        ));
    }
};

backgroundScript.run();

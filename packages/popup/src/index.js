import React from 'react';
import ReactDOM from 'react-dom';
import reduxLogger from 'redux-logger';
import App from 'app';
import Logger from '@tronmask/lib/logger';
import MessageDuplex from '@tronmask/lib/MessageDuplex';
import reducer from 'reducers';
import { addLocaleData } from 'react-intl';
import en from 'react-intl/locale-data/en';
import zh from 'react-intl/locale-data/zh';
import { Provider } from 'react-redux';
import { configureStore, getDefaultMiddleware } from 'redux-starter-kit';
import { PopupAPI } from '@tronmask/lib/api';
import { setConfirmations } from 'reducers/confirmationsReducer';
import { library } from '@fortawesome/fontawesome-svg-core';
import { version } from '@tronmask/popup/package';
import { Toast } from 'antd-mobile';
import 'rc-tooltip/assets/bootstrap.css';

import {
    setAppState,
    setNodes,
    setLanguage,
    setSetting,
    setVersion,
    setAuthorizeDapps,
    setVTokenList,
    setChains,
} from 'reducers/appReducer';

import {
    setAccount,
    setAccounts,
    setToken,
} from 'reducers/accountsReducer';

// This should be added into it's own class, and just call IconLibrary.init();
import {
    faLock,
    faCheckCircle,
    faTimesCircle,
    faCircle,
    faDotCircle
} from '@fortawesome/free-solid-svg-icons';
import { APP_STATE } from '@tronmask/lib/constants';

addLocaleData([...en, ...zh]);

const logger = new Logger('Popup');

export const app = {
    duplex: new MessageDuplex.Popup(),
    async run() {
        this.loadIcons();
        this.createStore();
        await this.getAppState();
        this.bindDuplexRequests();
        this.render();
    },

    loadIcons() {
        library.add(
            faLock,
            faCheckCircle,
            faTimesCircle,
            faDotCircle,
            faCircle
        );
    },

    createStore() {
        logger.info('Creating redux store');

        this.store = configureStore({
            middleware: [
                ...getDefaultMiddleware(),
                reduxLogger
            ],
            reducer
        });

        logger.info('Created store', this.store);
    },

    async getAppState() {
        PopupAPI.init(this.duplex);
        const setting = await PopupAPI.getSetting();
        if (setting.lock.duration !== 0 && new Date().getTime() - setting.lock.lockTime > setting.lock.duration) {
            PopupAPI.lockWallet();
        }
        let [
            appState,
            nodes,
            accounts,
            selectedAccount,
            confirmations,
            selectedToken,
            language,
            authorizeDapps,
            vTokenList,
            chains,
        ] = await Promise.all([
            PopupAPI.requestState(),
            PopupAPI.getNodes(),
            PopupAPI.getAccounts(),
            PopupAPI.getSelectedAccount(),
            PopupAPI.getConfirmations(),
            PopupAPI.getSelectedToken(),
            PopupAPI.getLanguage(),
            PopupAPI.getAuthorizeDapps(),
            PopupAPI.getVTokenList(),
            PopupAPI.getChains(),
        ]);
        // force a jump
        if(appState === APP_STATE.EXPORT_ACCOUNT){
            await PopupAPI.resetState()
        }

        const lang = navigator.language || navigator.browserLanguage;
        if (lang.indexOf('zh') > -1) {
            language = language || 'zh';
        } else if (lang.indexOf('ja') > -1) {
            language = language || 'ja';
        } else {
            language = language || 'en';
        }
        this.store.dispatch(setAppState(appState));
        this.store.dispatch(setNodes(nodes));
        this.store.dispatch(setAccounts(accounts));
        this.store.dispatch(setConfirmations(confirmations));
        this.store.dispatch(setToken(selectedToken));
        this.store.dispatch(setLanguage(language));
        this.store.dispatch(setSetting(setting));
        this.store.dispatch(setVersion(version));
        this.store.dispatch(setAuthorizeDapps(authorizeDapps));
        this.store.dispatch(setVTokenList(vTokenList));
        this.store.dispatch(setChains(chains));
        if (selectedAccount) {
            this.store.dispatch(setAccount(selectedAccount));
        }
        Toast.config({ mask: false });
        logger.info('Set application state');
    },

    async getNodes() {
        const nodes = await PopupAPI.getNodes();

        this.store.dispatch(
            setNodes(nodes)
        );
    },

    async getChains() {
        const chains = await PopupAPI.getChains();

        this.store.dispatch(
            setChains(chains)
        );
    },

    bindDuplexRequests() {
        this.duplex.on('setState', appState => this.store.dispatch(
            setAppState(appState)
        ));

        this.duplex.on('setConfirmations', confirmations => this.store.dispatch(
            setConfirmations(confirmations)
        ));

        this.duplex.on('setAccount', account => this.store.dispatch(
            setAccount(account)
        ));

        this.duplex.on('setAccounts', accounts => this.store.dispatch(
            setAccounts(accounts)
        ));

        this.duplex.on('setSelectedToken', token => this.store.dispatch(
            setToken(token)
        ));

        this.duplex.on('setLanguage', language => this.store.dispatch(
            setLanguage(language)
        ));

        this.duplex.on('setSetting', setting => this.store.dispatch(
            setSetting(setting)
        ));

        this.duplex.on('setAuthorizeDapps', authorizeDapps => this.store.dispatch(
            setAuthorizeDapps(authorizeDapps)
        ));

        this.duplex.on('setVTokenList', vTokenList => this.store.dispatch(
            setVTokenList(vTokenList)
        ));

        this.duplex.on('setChain', chains => this.store.dispatch(
            setChains(chains)
        ));

        this.duplex.on('setNodes', nodes => this.store.dispatch(
            setNodes(nodes)
        ));

    },

    render() {
        logger.info('Rendering application');
        ReactDOM.render(
            <Provider store={ this.store }>
                <App />
            </Provider>,
            document.getElementById('root')
        );
    }
};

app.run();

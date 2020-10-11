import {
    APP_STATE,
    PAGES
} from '@tronmask/lib/constants';

import {
    createReducer,
    createAction
} from 'redux-starter-kit';

export const setAppState = createAction('setAppState');
export const setNodes = createAction('setNodes');
export const setPage = createAction('setPage');
export const setLanguage = createAction('setLanguage');
export const setSetting = createAction('setSetting');
export const setVersion = createAction('setVersion');
export const setAuthorizeDapps = createAction('setAuthorizeDapps');
export const setVTokenList = createAction('setVTokenList');
export const setChains = createAction('setChains');

export const appReducer = createReducer({
    appState: APP_STATE.UNINITIALISED,
    currentPage: PAGES.ACCOUNTS,
    nodes: {
        nodes: {},
        selected: false
    },
    chains: {
        chains: {},
        selected: false
    },
    language: 'en',
    setting: {
        developmentMode: false
    },
    version: '',
    authorizeDapps: {},
    vTokenList:[],
}, {
    [ setAppState ]: (state, { payload }) => {
        state.appState = payload;
    },
    [ setNodes ]: (state, { payload }) => {
        state.nodes = payload;
    },
    [ setChains ]: (state, { payload }) => {
        state.chains = payload;
    },
    [ setPage ]: (state, { payload }) => {
        state.currentPage = payload;
    },
    [ setLanguage ]: (state, { payload }) => {
        state.language = payload;
    },
    [ setSetting ]: (state, { payload }) => {
        state.setting = payload;
    },
    [ setVersion ]: (state, { payload }) => {
        state.version = payload;
    },

    [ setAuthorizeDapps ]: (state, { payload }) => {
        state.authorizeDapps = payload;
    },

    [ setVTokenList ]: (state, { payload }) =>{
        state.vTokenList = payload;
    },
});

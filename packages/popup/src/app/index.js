import React from 'react';
import { IntlProvider, FormattedMessage } from 'react-intl';
import { connect } from 'react-redux';
import { PopupAPI } from '@tronmask/lib/api';

import { APP_STATE } from '@tronmask/lib/constants';

import RegistrationController from '@tronmask/popup/src/controllers/RegistrationController';
import LoginController from '@tronmask/popup/src/controllers/LoginController';
import WalletCreationController from '@tronmask/popup/src/controllers/WalletCreationController';
import CreateAccountController from '@tronmask/popup/src/controllers/CreateAccountController';
import RestoreAccountController from '@tronmask/popup/src/controllers/RestoreAccountController';
import PageController from '@tronmask/popup/src/controllers/PageController';
import ConfirmationController from '@tronmask/popup/src/controllers/ConfirmationController2';
import SettingController from '@tronmask/popup/src/controllers/SettingController';
import AssetManageController from '@tronmask/popup/src/controllers/AssetManageController';
import DappWhitelistController from '@tronmask/popup/src/controllers/DappWhitelistController';
import NodeManageController from '@tronmask/popup/src/controllers/NodeManageController';
import ExportAccountController from '@tronmask/popup/src/controllers/ExportAccountController';

import 'antd-mobile/dist/antd-mobile.css';
import 'assets/styles/global.scss';
import 'react-toast-mobile/lib/react-toast-mobile.css';

import enMessages from '@tronmask/popup/src/translations/en.json';
import zhMessages from '@tronmask/popup/src/translations/zh.json';

class App extends React.Component {
    messages = {
        en: enMessages,
        zh: zhMessages
    };

    render() {
        const { appState, accounts, nodes, language, lock, version, authorizeDapps, vTokenList, chains } = this.props;
        let dom = null;
        switch (appState) {
            case APP_STATE.UNINITIALISED:
                dom = <RegistrationController language={language}/>;
                break;
            case APP_STATE.PASSWORD_SET:
                dom = <LoginController/>;
                break;
            case APP_STATE.UNLOCKED:
                dom = <WalletCreationController/>;
                break;
            case APP_STATE.CREATING:
                dom = <CreateAccountController/>;
                break;
            case APP_STATE.RESTORING:
                dom = <RestoreAccountController/>;
                break;
            case APP_STATE.READY:
                dom = <PageController/>;
                break;
            case APP_STATE.REQUESTING_CONFIRMATION:
                // Prevent multilingual loss
                localStorage.setItem('la', language);
                dom = <ConfirmationController authorizeDapps={authorizeDapps} accounts={accounts} nodes={nodes}
                                              chains={chains}/>;
                break;
            case APP_STATE.SETTING:
                dom = <SettingController lock={lock} version={version} language={language}
                                         onCancel={() => PopupAPI.changeState(APP_STATE.READY)}/>;
                break;
            case APP_STATE.ASSET_MANAGE:
                dom = <AssetManageController chains={chains} vTokenList={vTokenList} selected={accounts.selected}
                                             nodes={nodes} onCancel={() => PopupAPI.changeState(APP_STATE.READY)}/>;
                break;
            case APP_STATE.DAPP_WHITELIST:
                dom = <DappWhitelistController authorizeDapps={authorizeDapps}
                                               onCancel={() => PopupAPI.changeState(APP_STATE.SETTING)}/>;
                break;
            case APP_STATE.NODE_MANAGE:
                dom = <NodeManageController nodes={nodes} chains={chains}
                                            onCancel={() => PopupAPI.changeState(APP_STATE.SETTING)}/>;
                break;
            case APP_STATE.EXPORT_ACCOUNT:
                dom = <ExportAccountController accounts={accounts}/>;
                break;
            default:
                dom =
                    <div className='unsupportedState' onClick={() => PopupAPI.resetState(APP_STATE.USDT_INCOME_RECORD)}>
                        <FormattedMessage id='ERRORS.UNSUPPORTED_STATE' values={{ appState }}/>
                    </div>;
        }

        return (
            <IntlProvider locale={language} messages={this.messages[language]}>
                {dom}
            </IntlProvider>
        );
    }
}

export default connect(state => ({
    vTokenList: state.app.vTokenList,
    language: state.app.language,
    appState: state.app.appState,
    accounts: state.accounts,
    nodes: state.app.nodes,
    lock: state.app.setting.lock,
    version: state.app.version,
    authorizeDapps: state.app.authorizeDapps,
    chains: state.app.chains,
}))(App);

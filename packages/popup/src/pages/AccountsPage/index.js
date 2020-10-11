import React from 'react';
import CopyToClipboard from 'react-copy-to-clipboard';
import swal from 'sweetalert2';
import { Toast } from 'antd-mobile';
import { BigNumber } from 'bignumber.js';
import { PopupAPI } from '@tronmask/lib/api';
import Utils from '@tronmask/lib/utils';
import Header from '@tronmask/popup/src/controllers/PageController/Header';
import ProcessBar from '@tronmask/popup/src/components/ProcessBar';
import Button from '@tronmask/popup/src/components/Button';
import { connect } from 'react-redux';
import {
    CONTRACT_ADDRESS, APP_STATE, BUTTON_TYPE, ACCOUNT_TYPE, VALIDATION_STATE
} from '@tronmask/lib/constants';
import { FormattedHTMLMessage, FormattedMessage, injectIntl } from 'react-intl';
import { app } from '@tronmask/popup/src';
import Alert from '@tronmask/popup/src/components/Alert';
import './AccountsPage.scss';
import '@tronmask/popup/src/controllers/PageController/Header/Header.scss';
import Input from '../../components/Input';
import { get as lodashGet, floor as lodashFloor } from 'lodash';
import InputCriteria from '../../components/InputCriteria';
import Tooltip from 'rc-tooltip';

const trxImg = require('@tronmask/popup/src/assets/icon/trx.png');
const token10DefaultImg = require('@tronmask/popup/src/assets/icon/token_10_default.png');

class AccountsPage extends React.Component {
    constructor() {
        super();
        this.onClick = this.onClick.bind(this);
        this.onDelete = this.onDelete.bind(this);
        this.onExport = this.onExport.bind(this);
        this.onChange = this.onChange.bind(this);
        this.onUpdateName = this.onUpdateName.bind(this);
        this.onConfirmPassword = this.onConfirmPassword.bind(this);
        this.onReset = this.onReset.bind(this);
        this.state = {
            mnemonic: false,
            privateKey: false,
            showChainList: false,
            showDelete: false,
            showUpdateName: false,
            showConfirmPassword: false,
            allTokens: [],
            updateNameValid: {
                name: '',
                isValid: VALIDATION_STATE.NONE,
                hasLength: false,
                isAlphanumeric: false,
                isUnique: false,
                showCriteria: false
            },
            confirmPassword: {
                password: '',
                isValid: true
            },
            copyTipId: 'TOAST.COPY_TIP',
        };
    }

    async componentDidMount() {
        const timer = setInterval(async () => {
            const allTokens = await PopupAPI.getAllTokens();
            if (allTokens.length) {
                clearInterval(timer);
                this.setState({ allTokens });
            }
        }, 100);
        const t = {
            name: 'TRX',
            abbr: 'trx',
            id: '_',
            amount: 0,
            decimals: 6,
            price: 0,
            imgUrl: trxImg
        };
        PopupAPI.setSelectedToken(t);
        app.getChains();

    }

    onClick(address) {
        const { selected } = this.props.accounts;

        if (selected.address === address) {
            return;
        }

        PopupAPI.selectAccount(address);
    }

    async onDelete() {
        const { formatMessage } = this.props.intl;
        if (Object.keys(this.props.accounts.accounts).length === 1) {
            swal(formatMessage({ id: 'At least one account is required' }), '', 'warning');
        } else {
            this.setState({
                showDelete: true
            });
        }
    }

    async onExport() {
        const {
            mnemonic,
            privateKey
        } = await PopupAPI.exportAccount();
        this.setState({
            mnemonic,
            privateKey,
        });
    }

    async onUpdateName() {
        this.setState({
            showUpdateName: true
        });
    }

    async onConfirmPassword() {
        this.setState({
            showConfirmPassword: true
        });
    }

    handleShowChainList() {
        this.setState({
            showChainList: !this.state.showChainList
        });
    }

    handleSelectChain(chainId) {
        const { nodes } = this.props;
        const { formatMessage } = this.props.intl;
        const currentNode = lodashGet(nodes, `nodes.${nodes.selected}`);
        const connectNode = lodashGet(nodes, `nodes.${currentNode.connect}`);
        if (!connectNode) {
            this.setState({ showChainList: false });
            Toast.info(formatMessage({ id: 'TOAST.NO_DAPPCHAIN' }, { name: currentNode.name }));
        } else {
            PopupAPI.selectChain(chainId);
            this.linkNode(chainId);
            this.handleShowChainList();
            PopupAPI.refresh();
            this.changeUrl();
        }
    }

    linkNode = (chainId) => {

        if (this.props.chains.selected === chainId) {
            return;
        }

        const { nodes } = this.props;
        const connect = nodes.nodes[nodes.selected].connect;
        if (connect) {
            PopupAPI.selectNode(connect);
        }
        app.getNodes();
    };

    renderAccountInfo(accounts) {
        const { formatMessage } = this.props.intl;
        const { copyTipId } = this.state;
        const account = accounts.accounts[accounts.selected.address];
        let timeoutId = null;
        return (
            <div className='accountInfo'>
                <div className='row1'>
                    <div className='accountWrap' onClick={async (e) => {
                        const setting = await PopupAPI.getSetting();
                        const openAccountsMenu = true;
                        PopupAPI.setSetting({ ...setting, openAccountsMenu });
                    }}
                    >
                        {
                            accounts.selected.type === ACCOUNT_TYPE.LEDGER ? <div className="ledger">&nbsp;</div> : null
                        }
                    </div>
                    <div className='accountName'>
                        <Tooltip
                            placement="bottom"
                            overlay={
                                <div>
                                    <FormattedMessage id={copyTipId}/>
                                </div>
                            }
                            animation="zoom"
                        >
                            <CopyToClipboard text={accounts.selected.address} onCopy={(e) => {
                                this.setState({
                                    copyTipId: 'TOAST.COPY',
                                });
                                if (timeoutId) {
                                    clearTimeout(timeoutId);
                                }
                                timeoutId = setTimeout(() => {
                                    this.setState({
                                        copyTipId: 'TOAST.COPY_TIP'
                                    });
                                }, 5000);
                            }}>
                                <div className='selected-account'>
                                    <div className='selected-account-name'>
                                        {accounts.selected.name.length > 20
                                            ? accounts.selected.name.substring(0, 10) + '...' + accounts.selected.name.substring(accounts.selected.name.length - 10)
                                            : accounts.selected.name
                                        }</div>
                                    <div className='selected-account-address'>
                                        {`${accounts.selected.address.substring(0, 10)}...${accounts.selected.address.substring(accounts.selected.address.length - 10)}`}
                                    </div>
                                </div>
                            </CopyToClipboard>
                        </Tooltip>
                    </div>
                    <div className='menu' onClick={(e) => {
                        e.stopPropagation();
                    }}>
                    </div>
                </div>
                <div className='row2'>
                    <img className='tron-logo'
                         src="data:image/png;base64,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"
                         alt=""/>
                    <div className='currency-display'>
                        <span className='amount'>
                            {new BigNumber(accounts.selected.balance + (accounts.selected.frozenBalance ? accounts.selected.frozenBalance : 0)).shiftedBy(-6).toFixed(2, 1)}
                        </span>
                        <span className='tag'>TRX</span>
                    </div>
                </div>
                <div className="row3">
                    <div className='resource'>
                        <div className={'cell bankSingle'}>
                            <div className='title'>
                                <span className={'blueColor'}>
                                    <FormattedMessage id='CONFIRMATIONS.RESOURCE.BANDWIDTH'/>
                                </span>
                                <div className='num'>
                                    {account.netLimit - account.netUsed}<span>/{account.netLimit}</span>
                                </div>
                            </div>
                            <ProcessBar percentage={(account.netLimit - account.netUsed) / account.netLimit}/>
                        </div>
                        <div className={'cell bankSingle'}>
                            <div className='title'>
                                {
                                    <span className={'bankBox blueColor'}>
                                        <FormattedMessage id='CONFIRMATIONS.RESOURCE.ENERGY'/>
                                    </span>
                                }
                                <div className='num'>
                                    {(account.energy - account.energyUsed) < 0 ? 0 : (account.energy - account.energyUsed)}<span>/{account.energy < 0 ? 0 : account.energy}</span>
                                </div>
                            </div>
                            <ProcessBar
                                percentage={(account.energy <= 0 || (account.energy - account.energyUsed) < 0) ? 0 : (account.energy - account.energyUsed) / account.energy}/>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    renderTokens(tokens) {
        const { accounts, chains } = this.props;
        return (
            <div className='tokens'>
                {
                    tokens.filter(({ tokenId, ...token }) => !token.hasOwnProperty('chain') || token.chain === chains.selected).map(({ tokenId, ...token }) => {
                        const balance = token.balanceStr != undefined ? token.balanceStr : token.balance;
                        let amount = new BigNumber(balance)
                            .shiftedBy(-token.decimals)
                            .toString();
                        let amountBackup = amount;
                        if (amount) {
                            amount = lodashFloor(amount, 6);
                        }
                        const name = token.abbr || token.symbol || token.name;
                        return (
                            <div className='tokenItem' onClick={() => {
                                let o = {
                                    id: tokenId,
                                    name: token.name,
                                    abbr: token.abbr || token.symbol,
                                    decimals: token.decimals,
                                    amount: amountBackup,
                                    price: 0,
                                    imgUrl: token.imgUrl ? token.imgUrl : token10DefaultImg,
                                    isMapping: token.isMapping
                                };
                                if (tokenId === '_') {
                                    o.frozenBalance = new BigNumber(accounts.selected.frozenBalance)
                                        .shiftedBy(-token.decimals)
                                        .toString();
                                    o.balance = new BigNumber(accounts.selected.balance)
                                        .shiftedBy(-token.decimals)
                                        .toString();
                                }
                                PopupAPI.setSelectedToken(o);
                                PopupAPI.changeState(APP_STATE.TRANSACTIONS);
                            }}
                            >
                                <img src={token.imgUrl || token10DefaultImg} onError={(e) => {
                                    e.target.src = token10DefaultImg;
                                }} alt=""/>
                                <div className="desc">
                                    <div className='desc-name'>
                                        {name.length > 16 ? name.substring(0, 8) + '...' + name.substring(name.length - 8) : name}
                                    </div>
                                    {
                                        tokenId === '_' ? null :
                                            <div className='desc-id'>
                                                {tokenId.match(/^T/) ? 'contract' : 'ID'}:{tokenId.match(/^T/) ? tokenId.substr(0, 7) + '...' + tokenId.substr(-7) : tokenId}
                                            </div>
                                    }

                                </div>
                                <div className="worth">
                                    <span>{amount}</span>
                                    <span> </span>
                                </div>
                            </div>
                        );
                    })
                }
                <div>
                    <button className="add-token-button" onClick={ () => {
                        PopupAPI.changeState(APP_STATE.ASSET_MANAGE);
                    }}>
                        <FormattedMessage id='BUTTON.ADD_TOKEN' />
                    </button>
                </div>
            </div>
        );
    }

    renderDeleteAccount() {
        const { showDelete } = this.state;
        const dom = showDelete
            ?
            <div className='popUp'>
                <div className='deleteAccount'>
                    <div className='title'>
                        <FormattedMessage id='ACCOUNTS.CONFIRM_DELETE'/>
                    </div>
                    <div className='img'></div>
                    <div className='txt'>
                        <FormattedMessage id='ACCOUNTS.CONFIRM_DELETE.BODY'/>
                    </div>
                    <div className='buttonRow'>
                        <Button
                            id='BUTTON.CANCEL'
                            type={BUTTON_TYPE.DANGER}
                            onClick={() => {
                                this.setState({ showDelete: false });
                            }}
                            tabIndex={1}
                        />
                        <Button
                            id='BUTTON.CONFIRM'
                            onClick={() => {
                                PopupAPI.deleteAccount();
                                this.setState({ showDelete: false });
                            }}
                            tabIndex={1}
                        />
                    </div>
                </div>
            </div>
            : null;
        return dom;
    }

    renderUpdateName() {
        const { showUpdateName } = this.state;
        const {
            name,
            isValid,
            hasLength,
            isAlphanumeric,
            isUnique,
            showCriteria
        } = this.state.updateNameValid;
        const { formatMessage } = this.props.intl;
        const isNameValid = isValid === VALIDATION_STATE.VALID;
        const dom = showUpdateName
            ?
            <div className='popUp'>
                <div className='updateName'>
                    <div className='title'>
                        <FormattedMessage id='MENU.UPDATE_NAME'/>
                    </div>
                    <div className='option'>
                        <Input
                            placeholder='INPUT.ACCOUNT_NEW_NAME'
                            // status={ isValid }
                            value={name}
                            onChange={this.onChange}
                            // onEnter={ () => isNameValid && onSubmit(name) }
                            tabIndex={1}
                        />
                        {
                            showCriteria ?
                                <div className='criteria'>
                                    <InputCriteria id='CREATION_CRITERIA.HAS_LENGTH' isValid={hasLength}/>
                                    <InputCriteria id='CREATION_CRITERIA.IS_ALPHANUMERIC' isValid={isAlphanumeric}/>
                                    <InputCriteria id='CREATION_CRITERIA.IS_UNIQUE' isValid={isUnique}/>
                                </div>
                                :
                                null
                        }
                    </div>
                    <div className='buttonRow'>
                        <Button
                            id='BUTTON.CLOSE'
                            type={BUTTON_TYPE.DANGER}
                            onClick={() => this.onReset()}
                            tabIndex={1}
                        />
                        <Button
                            id='BUTTON.FINISH'
                            isValid={isNameValid}
                            onClick={() => {
                                isNameValid && PopupAPI.updateAccountName(name) && this.onReset();
                                Toast.info(formatMessage({ id: 'TOAST.UPDATE_NAME' }));
                            }}
                            tabIndex={1}
                        />
                    </div>
                </div>
            </div>
            : null;
        return dom;
    }

    renderConfirmPassword() {
        const { showConfirmPassword, confirmPassword: { password, isValid } } = this.state;
        const { formatMessage } = this.props.intl;
        const dom = showConfirmPassword
            ?
            <div className='popUp'>
                <div className='confirmPassword'>
                    <div className='title'>
                        <FormattedMessage id='MENU.ENTER_PASSWORD'/>
                    </div>
                    <div className="option">
                        <Input className={password && !isValid ? 'error' : ''}
                               placeholder='INPUT.PASSWORD'
                               type='password'
                               value={password}
                               onChange={this.onConfirmPasswordChange.bind(this)}
                               tabIndex={1}
                        />
                        {
                            password && !isValid ?
                                <div className='errTip'>
                                    {formatMessage({ id: 'ERRORS.INVALID_PASSWORD_RETRY' })}
                                </div>
                                :
                                null
                        }
                    </div>
                    <div className='buttonRow'>
                        <Button
                            id='BUTTON.CANCEL'
                            type={BUTTON_TYPE.DANGER}
                            onClick={() => this.onReset('confirmPassword')}
                            tabIndex={1}
                        />
                        <Button
                            id='BUTTON.CONFIRM'
                            isValid={!!password}
                            onClick={this.onAuthPassword.bind(this)}
                            tabIndex={1}
                        />
                    </div>
                </div>
            </div>
            : null;
        return dom;
    }

    onChange(name) {
        const { accounts } = this.props.accounts;
        const trimmed = name.replace(/\s{2,}/g, ' ');
        const showCriteria = trimmed.length !== 0;
        const updateNameValid = {
            name: '',
            isValid: VALIDATION_STATE.NONE,
            hasLength: false,
            isAlphanumeric: false,
            isUnique: false,
            showCriteria
        };

        if (/^\s$/.test(name) || !trimmed.length) {
            return this.setState({ updateNameValid });
        }

        if (trimmed.trim().length >= 4) {
            updateNameValid.hasLength = true;
        }

        if (/^([A-Za-z\d\s])+$/.test(trimmed)) {
            updateNameValid.isAlphanumeric = true;
        }

        if (!Object.values(accounts).some(({ name }) => name === trimmed.trim())) {
            updateNameValid.isUnique = true;
        }

        if (updateNameValid.hasLength && updateNameValid.isAlphanumeric && updateNameValid.isUnique) {
            updateNameValid.isValid = VALIDATION_STATE.VALID;
        } else {
            updateNameValid.isValid = VALIDATION_STATE.INVALID;
        }

        updateNameValid.name = trimmed;
        this.setState({ updateNameValid });
    }

    onConfirmPasswordChange(password) {
        const { confirmPassword } = this.state;
        confirmPassword.password = password;
        confirmPassword.isValid = true;
        this.setState({ confirmPassword });
    }

    async onAuthPassword() {
        const { confirmPassword } = this.state;
        const { password } = confirmPassword || {};
        if (password) {
            const auth = await PopupAPI.authPassword(password);
            if (auth) {
                // this.onExport();
                this.onReset('confirmPassword');
                PopupAPI.changeState(APP_STATE.EXPORT_ACCOUNT);
            } else {
                confirmPassword.isValid = false;
                this.setState({ confirmPassword });
            }
        }
    }

    onReset(type = 'updateName') {
        switch (type) {
            case 'updateName':
                const updateNameValid = {
                    name: '',
                    isValid: VALIDATION_STATE.NONE,
                    hasLength: false,
                    isAlphanumeric: false,
                    isUnique: false,
                    showCriteria: false
                };
                this.setState({ updateNameValid, showUpdateName: false });
                break;
            case 'confirmPassword':
                const confirmPassword = {
                    password: '',
                    isValid: true
                };
                this.setState({ confirmPassword, showConfirmPassword: false });
                break;
        }
    }

    render() {
        BigNumber.config({ EXPONENTIAL_AT: [-20, 30] });
        let totalTrx = new BigNumber(0);
        const { showChainList } = this.state;
        const { accounts, setting, vTokenList, chains } = this.props;

        const { formatMessage } = this.props.intl;
        const trx = {
            tokenId: '_',
            name: 'TRX',
            balance: (accounts.selected.balance + (accounts.selected.frozenBalance ? accounts.selected.frozenBalance : 0)),
            abbr: 'TRX',
            decimals: 6,
            imgUrl: trxImg,
            price: 0,
            isMapping: true
        };
        let tokens = { ...accounts.selected.tokens.basic, ...accounts.selected.tokens.smart };
        const topArray = [];
        tokens = Utils.dataLetterSort(Object.entries(tokens).filter(([tokenId, token]) => typeof token === 'object').map(v => {
            v[1].isMapping = v[1].hasOwnProperty('isMapping') ? v[1].isMapping : true;
            v[1].tokenId = v[0];
            return v[1];
        }).filter(v => !v.isLocked), 'abbr', 'symbol', topArray);
        tokens = [trx, ...tokens];
        tokens = tokens.map(({ tokenId, ...token }) => {
            token.decimals = token.decimals || 0;
            if (vTokenList.includes(tokenId)) {
                token.isVerify = true;
            }

            return { tokenId, ...token };
        });

        Object.entries(accounts.accounts).map(([address, account]) => {
            totalTrx = totalTrx.plus(new BigNumber(account.balance).shiftedBy(-6));
        });

        return (
            <div className='accountsPage'>
                {
                    this.renderDeleteAccount()
                }
                {
                    this.renderUpdateName()
                }
                {
                    this.renderConfirmPassword()
                }
                <Header showChainList={showChainList} developmentMode={setting.developmentMode} chains={chains}
                        handleSelectChain={this.handleSelectChain.bind(this)}
                        handleShowChainList={this.handleShowChainList.bind(this)}/>
                <div className='space-controller'>
                    <div className={'accountsWrap' + (setting.openAccountsMenu ? ' show' : '')}>
                        <div className="accounts">
                            <div className="row1">
                                <div className="cell" onClick={() => {
                                    PopupAPI.changeState(APP_STATE.CREATING);
                                }}>
                                    <FormattedMessage id="CREATION.CREATE.TITLE"/>
                                </div>
                                <div className="cell" onClick={() => {
                                    PopupAPI.changeState(APP_STATE.RESTORING);
                                }}>
                                    <FormattedMessage id="CREATION.RESTORE.TITLE"/>
                                </div>
                            </div>
                            <div className="row2">
                                <div className="cell">
                                    <span>TRX:</span>
                                    <span>{new BigNumber(lodashFloor(totalTrx, 3)).toFormat()}</span>
                                </div>
                            </div>
                            <div className="row3">
                                {
                                    Object.entries(accounts.accounts).map(([address, account], i) => {
                                        return (
                                            <div
                                                className={'cell cell' + (i % 5 + 1) + (accounts.selected.address === address ? ' selected' : '')}
                                                onClick={async () => {
                                                    const setting = await PopupAPI.getSetting();
                                                    const openAccountsMenu = false;
                                                    PopupAPI.setSetting({ ...setting, openAccountsMenu });
                                                    if (accounts.selected.address === address) {
                                                        return;
                                                    }
                                                    PopupAPI.selectAccount(address);
                                                }}>
                                                <div className="top">
                                                    <div className="name">
                                                        <div className="nameWrap">
                                                            {account.name.length > 30 ? account.name.substr(0, 30) + '...' : account.name}
                                                            {account.type === ACCOUNT_TYPE.LEDGER ?
                                                                <div className="ledger">&nbsp;</div> : null}
                                                        </div>
                                                    </div>
                                                    <div className="asset">
                                                        <span>TRX: {new BigNumber(new BigNumber(account.balance).shiftedBy(-6).toFixed(3, 1)).toFormat()}</span>
                                                    </div>
                                                </div>
                                                <div className="bottom">
                                                    <span>{address.substr(0, 10) + '...' + address.substr(-10)}</span>
                                                    <div onClick={(e) => {
                                                        e.stopPropagation();
                                                    }}>
                                                        <CopyToClipboard text={address}
                                                                         onCopy={(e) => {
                                                                             Toast.info(formatMessage({ id: 'TOAST.COPY' }));
                                                                         }}>
                                                            <span className='copy'></span>
                                                        </CopyToClipboard>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                        <div className='closed' onClick={async () => {
                            const setting = await PopupAPI.getSetting();
                            const openAccountsMenu = false;
                            PopupAPI.setSetting({ ...setting, openAccountsMenu });
                        }}>
                        </div>
                    </div>
                    {accounts.selected.address ? this.renderAccountInfo(accounts) : null}
                    <div className="listWrap">
                        <div className="scroll" onScroll={(e) => {
                            e.stopPropagation();
                        }}>
                            {this.renderTokens(tokens)}
                        </div>
                    </div>
                </div>
                {
                    setting.showUpdateDescription
                        ?
                        <div className="alertWrap">
                            <Alert show={setting.showUpdateDescription} buttonText="BUTTON.GOT_IT"
                                   title={formatMessage({ id: 'ALERT.UPDATE_DESCRIPTION.TITLE' })}
                                   body={formatMessage({ id: 'ALERT.UPDATE_DESCRIPTION.BODY' })}
                                   onClose={async () => {
                                       const setting = await PopupAPI.getSetting();
                                       PopupAPI.setSetting({ ...setting, showUpdateDescription: false });
                                   }}/>
                        </div>
                        :
                        null
                }
            </div>
        );
    }
}

export default injectIntl(
    connect(state => ({
        chains: state.app.chains,
        vTokenList: state.app.vTokenList,
        language: state.app.language,
        accounts: state.accounts,
        nodes: state.app.nodes,
        setting: state.app.setting,
    }))(AccountsPage)
);

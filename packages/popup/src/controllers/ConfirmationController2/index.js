import React from 'react';
import Button from '@tronmask/popup/src/components/Button';
import TronWeb from 'tronweb';
import Dropdown from 'react-dropdown';
import Utils from '@tronmask/lib/utils';
import { PopupAPI } from '@tronmask/lib/api';
import { connect } from 'react-redux';
import { Switch, Tabs, List } from 'antd-mobile';
import ReactTooltip from 'react-tooltip';
import {
    FormattedMessage,
    FormattedHTMLMessage,
    injectIntl
} from 'react-intl';

import {
    CONFIRMATION_TYPE,
    BUTTON_TYPE,
    ACCOUNT_TYPE
} from '@tronmask/lib/constants';
import { get as lodashGet, size as lodashSize } from 'lodash';

import 'react-dropdown/style.css';
import './ConfirmationController.scss';
import Loading from '../../components/Loading';
import { Toast } from 'antd-mobile';
import BigNumber from 'bignumber.js';

const Item = List.Item;

class ConfirmationController extends React.Component {
    constructor({ intl }) {
        super();
        this.loadWhitelistOptions(intl);
        this.onReject = this.onReject.bind(this);
        this.onAccept = this.onAccept.bind(this);
        this.onWhitelist = this.onWhitelist.bind(this);
        this.onAcceptLedger = this.onAcceptLedger.bind(this);
        this.listener = this.listener.bind(this);
    }

    async componentDidMount() {
        window.resizeTo(360 + window.outerWidth - window.innerWidth, 600 + window.outerHeight - window.innerHeight);
        const {
            type,
            contractType,
            input: { parameter, contract_address, function_selector, token_id, call_token_value, call_value, owner_address, asset_name }
        } = this.props.confirmation;
        window.addEventListener('message', this.listener, false);

        // need try catch
        try {
            // renderTransaction 使用
            if (asset_name) {
                new Promise(async (resolve) => {
                    const trc10Info = await PopupAPI.getTokenById(TronWeb.toUtf8(asset_name));
                    this.setState({ trc10Info });
                    resolve();
                });
            }
            if (contractType === 'TriggerSmartContract') {
                if (type === CONFIRMATION_TYPE.TRANSACTION) {
                    new Promise(async (resolve, reject) => {
                        const { accounts } = this.props;
                        let balance = new BigNumber(accounts.selected.balance).shiftedBy(-6).toString();
                        let unit = 'TRX';
                        let callValue = 0;
                        let show = false;
                        if (token_id) {
                            const tokenInfo = await PopupAPI.getTokenById(token_id);
                            const decimal = +tokenInfo.precision || 0;
                            unit = tokenInfo.abbr || tokenInfo.name || '';
                            callValue = new BigNumber(call_token_value || 0).shiftedBy(-decimal).toString();
                            show = true;
                            const tokenBalance = lodashGet(accounts, 'selected.tokens.basic.' + token_id + '.balance') || 0;
                            balance = new BigNumber(tokenBalance).shiftedBy(-decimal).toString();
                        } else if (call_value > 0) {
                            callValue = new BigNumber(call_value || 0).shiftedBy(-6).toString();
                            show = true;
                        }
                        if (show) {
                            let toAddress = TronWeb.address.fromHex(contract_address);
                            toAddress = [toAddress.substring(0, 8), toAddress.substring(toAddress.length - 7, toAddress.length)].join('...');
                            let sendAddress = TronWeb.address.fromHex(owner_address);
                            if (sendAddress && sendAddress.length > 10) {
                                sendAddress = [sendAddress.substring(0, 5), sendAddress.substr(sendAddress.length - 5, sendAddress.length)].join('...');
                            }
                            const name = lodashGet(accounts, 'selected.name');
                            if (name) {
                                sendAddress = `${name.length > 7 ? name.substring(0, 5) + '...' : name}(${sendAddress})`;
                            }
                            this.setState({
                                consume: {
                                    unit,
                                    callValue,
                                    balance,
                                    toAddress,
                                    sendAddress
                                }
                            });
                        } else {
                            this.setState({
                                consume: false
                            });
                        }
                        resolve();
                    }).catch(e => {
                        console.log('init show args data err', e.message);
                    });
                }

                const abi = await PopupAPI.getAbiCode(contract_address);
                const args = Utils.decodeParams(parameter, abi, function_selector);
                this.setState({ args });
            }
        } catch (e) {
            console.log('get abi err:', e.message);
        }
    }

    componentWillUnmount() {
        window.removeEventListener('message', this.listener, false);
    }

    loadWhitelistOptions({ formatMessage }) {
        const options = [{
            value: 60 * 60 * 1000,
            label: formatMessage({ id: 'CONFIRMATIONS.NEW.OPTIONS.ONE_HOUR' })
        }, {
            value: 24 * 60 * 60 * 1000,
            label: formatMessage({ id: 'CONFIRMATIONS.NEW.OPTIONS.ONE_DAY' })
        }, {
            value: -1,
            label: formatMessage({ id: 'CONFIRMATIONS.OPTIONS.NEXT_LOGIN' })
        }, {
            value: -2,
            label: formatMessage({ id: 'CONFIRMATIONS.NEW.OPTIONS.AUTO_AUTHORIZE' })
        }];

        // eslint-disable-next-line
        this.state = {
            args: [],
            showArgs: false,
            whitelisting: {
                selected: options[0],
                options,
                isAutoAuthorize: false
            },
            loading: false,
            active: false,
            consume: false,
            trc10Info: {}
        };
    }

    onReject() {
        PopupAPI.rejectConfirmation();
    }

    async onAccept() {
        const {
            selected,
            isAutoAuthorize
        } = this.state.whitelisting;
        const { confirmation, authorizeDapps } = this.props;
        if (confirmation.contractType === 'TriggerSmartContract') {
            const hostname = confirmation.hostname;
            if (isAutoAuthorize && selected.value === -2 && !authorizeDapps.hasOwnProperty(hostname)) {
                const o = {};
                o.url = confirmation.hostname;
                o.addTime = new Date().getTime();
                authorizeDapps[hostname] = o;
                PopupAPI.setAuthorizeDapps(authorizeDapps);
            }
        }
        PopupAPI.acceptConfirmation(isAutoAuthorize ? selected.value : false);
    }

    async onAcceptLedger() {
        const {
            signedTransaction
        } = this.props.confirmation;
        this.setState({ loading: true });
        const { selected } = this.props.accounts;
        document.querySelector('#tronLedgerBridge').contentWindow.postMessage({
            target: 'LEDGER-IFRAME',
            action: 'sign transaction',
            data: { transaction: signedTransaction, index: selected.accountIndex, fromAddress: selected.address }
        }, '*');
    }

    handleClose() {
        this.setState({ loading: false });
    }

    async listener(event) {
        const { selected } = this.props.accounts;
        const { formatMessage } = this.props.intl;
        if (event.data.target === 'LEDGER-IFRAME') {
            console.log(event.data);
            const { success, error, signedTransaction } = event.data;
            if (success) {
                this.setState({ loading: false });
                const {
                    selected: select
                } = this.state.whitelisting;
                const { confirmation, authorizeDapps } = this.props;
                if (confirmation.contractType === 'TriggerSmartContract') {
                }
                PopupAPI.acceptConfirmation(false, signedTransaction);
            } else {
                let id = '';
                if (error === 'User has not unlocked wallet') {
                    id = 'CREATION.LEDGER.CONNECT_TIMEOUT';
                } else if (error.match(/denied by the user/)) {
                    id = 'CREATION.LEDGER.REJECT';
                } else if (error.match(/U2F TIMEOUT/)) {
                    id = 'CREATION.LEDGER.AUTHORIZE_TIMEOUT';
                } else if (error === 'Cannot read property \'message\' of undefined') {
                    id = 'CREATION.LEDGER.NO_TOKEN';
                } else if (error === 'address not match') {
                    id = 'CREATION.LEDGER.NOT_MATCH';
                }
                this.setState({ loading: false });
                Toast.fail(id ? formatMessage({ id }) : error, 3, () => {
                }, true);
            }
        }
    }

    onWhitelist(selected) {
        this.setState({
            whitelisting: {
                ...this.state.whitelisting,
                selected
            }
        });
    }

    splitFunction(value, isFirst) {
        const { showArgs } = this.state;
        let index = 0;
        let valueArr = [];
        while (index < value.length) {
            valueArr.push(value.substring(index, index + 40));
            index = index + 40;
        }
        if (isFirst) {
            valueArr = [valueArr[0]];
        } else {
            valueArr = valueArr.slice(1);
        }

        return <div style={isFirst ? {} : { 'margin-top': '-10px' }}>
            {
                valueArr.map((clips, index) => {
                    if (index === 0 && isFirst) {
                        return <div
                            className="firstFunc"> {value.length > 40 ? clips.substring(0, 40) + (showArgs ? '' : '...') : clips} </div>;
                    } else {
                        return <div className="func"> {clips} </div>;
                    }
                })
            }
        </div>;

    }

    renderTransaction() {
        const { args, showArgs, consume, trc10Info = {} } = this.state;
        const {
            options,
            selected,
            isAutoAuthorize
        } = this.state.whitelisting;

        const { selected: nodeSelected } = this.props.nodes;

        const {
            formatMessage,
            formatNumber
        } = this.props.intl;

        const {
            contractType,
            input,
            chainType,
            type: confirmType
        } = this.props.confirmation;

        const { selected: { type } } = this.props.accounts;

        const meta = [];
        const showWhitelist = contractType === 'TriggerSmartContract';
        let showParameters = false;
        let netTypeText = 'CONFIRMATIONS.NEW.NETWORK.MAIN_NET';
        switch (nodeSelected) {
            case 'b9424719-b45b-45aa-95d0-1b1b25fc75ae': // shasta
                netTypeText = 'CONFIRMATIONS.NEW.NETWORK.SHASTA_NET';
                break;
            case 'f14212e2-a6a0-4391-9419-07b55f8be63e': // tron ex
            case '01eda3a0-5a58-4e44-9f95-f7f1f59dd728': // tron ex
                netTypeText = 'CONFIRMATIONS.NEW.NETWORK.TRONEX_NET';
                break;
            case '910d7fa5-da35-419d-b454-fd4ee22087cd': // nil ex
                netTypeText = 'CONFIRMATIONS.NEW.NETWORK.NILE_NET';
                break;
        }
        const chainTypeText = Number(chainType) === 1 ? 'CONFIRMATIONS.NEW.NETWORK.DAPPCHAIN' : 'CONFIRMATIONS.NEW.NETWORK.MAINCHAIN';
        meta.push({
            key: 'CONFIRMATIONS.NEW.TYPE',
            value: formatMessage({ id: `CONTRACTS.${contractType ? contractType : 'SignMessage'}` })
        });
        meta.push({
            key: 'CONFIRMATIONS.NEW.NETWORK',
            value: `${formatMessage({ id: netTypeText })} / ${formatMessage({ id: chainTypeText })}`
        });

        if (confirmType === CONFIRMATION_TYPE.TRANSACTION) {
            if (input.contract_address) {
                const address = TronWeb.address.fromHex(input.contract_address);
                meta.push({ key: 'CONFIRMATIONS.NEW.CONTRACT', value: TronWeb.address.fromHex(address) });
            }

            if (input.function_selector) {
                meta.push({ key: 'CONFIRMATIONS.NEW.FUNCTION', value: input.function_selector });
            }

            if (!(input.contract_address || input.function_selector) && input.amount) {
                if (contractType === 'TransferContract') {
                    meta.push({
                        key: 'CONFIRMATIONS.NEW.QUANTITY',
                        value: formatNumber(input.amount / 1000000, { maximumFractionDigits: 10 }) + ' TRX'
                    });
                } else {
                    meta.push({
                        key: 'CONFIRMATIONS.NEW.QUANTITY',
                        value: formatNumber(new BigNumber(input.amount).shiftedBy(-trc10Info.precision || 0).valueOf(), { maximumFractionDigits: 10 }) + ' ' + (trc10Info.abbr || trc10Info.name || '')
                    });
                }
                if (input.to_address) {
                    const address = TronWeb.address.fromHex(input.to_address);
                    meta.push({ key: 'CONFIRMATIONS.NEW.RECIPIENT', value: address });
                }
            }

            switch (contractType) {
                case 'ProposalCreateContract':
                case 'ExchangeCreateContract':
                case 'ExchangeInjectContract':
                case 'ExchangeWithdrawContract':
                case 'CreateSmartContract':
                    showParameters = true;
                    break;
                default:
                    showParameters = false;
            }
        }

        const tabs = [
            { title: formatMessage({ id: 'CONFIRMATIONS.MENU.DETAIL' }) },
            { title: formatMessage({ id: 'CONFIRMATIONS.MENU.DATA' }) },
        ];

        return (
            <React.Fragment>
                <Tabs tabs={tabs} initialPage={0} tabBarActiveTextColor="#F7861C" tabBarUnderlineStyle={{border: "1px solid rgba(247, 134, 28, 0.5)"}} >
                    <div className="body scroll"
                         style={showWhitelist && type !== 2 && confirmType === CONFIRMATION_TYPE.TRANSACTION ? {} : { 'height': '395px' }}>
                        {
                            consume ?
                                <div className="consume">
                                    <div className="amounts">
                                        {consume.callValue + ' ' + consume.unit}
                                    </div>
                                    <div className="detail">
                                        <div className="left center-align">
                                            <div
                                                className="acronyms center-align">{consume.sendAddress.substring(0, 2)}</div>
                                            <div className="address center-align">{consume.sendAddress}</div>
                                            <div
                                                className="balance center-align">{consume.balance || 0} {consume.unit}</div>
                                        </div>
                                        <div className="middle center-align"></div>
                                        <div className="fight center-align">
                                            <div
                                                className="acronyms center-align">{consume.toAddress.substring(0, 2)}</div>
                                            <div className="address center-align">{consume.toAddress}</div>
                                            <div className="balance center-align">&nbsp;</div>
                                        </div>
                                    </div>
                                </div>
                                : null
                        }


                        {meta.length ? (
                            <div className='meta'>
                                {meta.map(({ key, value }) => (
                                    <div className='metaLine' key={key}>
                                        <FormattedMessage id={key}/>
                                        <span className='value'>{value}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                    <div className="body scroll"
                         style={showWhitelist && type !== 2 && confirmType === CONFIRMATION_TYPE.TRANSACTION ? {} : { 'height': '395px' }}>
                        <List renderHeader={() => formatMessage({ id: 'CONFIRMATIONS.MENU.ARGS' })} className="my-list">
                            <Item wrap>
                                {
                                    JSON.stringify(args.map(({ name, value }) => {
                                        const v = {};
                                        v[name] = value;
                                        return v;
                                    }))
                                }
                            </Item>
                        </List>
                        <List renderHeader={() => formatMessage({ id: 'CONFIRMATIONS.MENU.HEX' })} className="my-list">
                            <Item wrap>
                                {
                                    // confirmType === CONFIRMATION_TYPE.STRING
                                    // ? input
                                    // : lodashGet(this.props.confirmation, 'signedTransaction.raw_data_hex')
                                    lodashGet(this.props.confirmation, 'signedTransaction.raw_data_hex')
                                }
                            </Item>
                        </List>
                    </div>
                </Tabs>

                {showWhitelist && type !== 2 && confirmType === CONFIRMATION_TYPE.TRANSACTION ? (
                    <div className='whitelist'>
                        <FormattedMessage
                            id='CONFIRMATIONS.WHITELIST.TITLE'
                            children={text => (
                                <div className='whitelistTitle'>
                                    <div>{text}</div>
                                    <div>
                                        <Switch
                                            checked={isAutoAuthorize}
                                            onClick={() => {
                                                let whitelisting = this.state.whitelisting;
                                                whitelisting.isAutoAuthorize = !isAutoAuthorize;
                                                this.setState({
                                                    whitelisting
                                                });
                                            }}
                                            color="#F7861C"
                                        />
                                    </div>
                                </div>
                            )}
                        />
                        <FormattedMessage
                            id='CONFIRMATIONS.WHITELIST.BODY'
                            children={text => (
                                <div className='whitelistBody'>
                                    {text}
                                </div>
                            )}
                        />
                        <Dropdown
                            disabled={!isAutoAuthorize}
                            className='dropdown'
                            options={options}
                            value={selected}
                            onChange={this.onWhitelist}
                        />
                    </div>
                ) : null}
            </React.Fragment>
        );
    }

    render() {
        const {
            type,
            input: { parameter, contract_address },
            chainType,
            hostname
        } = this.props.confirmation;

        const { loading } = this.state;
        const chainTypeText = Number(chainType) === 1 ? 'DAppChain' : 'MainChain';
        return (
            <div className='insetContainer confirmationController'>
                {
                    <div className='greyModal confirmModal'>
                        <FormattedMessage id='CONFIRMATIONS.NEW.HEADER'
                                          children={text => (
                                              <div className='pageHeader'>
                                                  {text}
                                              </div>
                                          )}
                        />
                        <div className='modalDesc'>
                            <span data-tip={encodeURIComponent(hostname)} data-for='showHostname'>
                                {encodeURIComponent(hostname).length > 40 ? encodeURIComponent(hostname).substring(0, 37) + '...' : encodeURIComponent(hostname)}
                            </span>
                            <ReactTooltip id='showHostname' effect='solid' place="bottom"/>
                            &nbsp;
                            <FormattedHTMLMessage
                                id='CONFIRMATIONS.NEW.BODY'
                                values={{
                                    hostname: ''
                                }}
                            />

                        </div>
                        {
                            this.renderTransaction()
                        }
                        {
                            this.props.type !== ACCOUNT_TYPE.LEDGER
                                ?
                                <div className='buttonRow'>
                                    <Button
                                        id='BUTTON.REJECT'
                                        type={BUTTON_TYPE.DANGER}
                                        onClick={this.onReject}
                                        tabIndex={3}
                                    />
                                    <Button
                                        id='BUTTON.ACCEPT'
                                        onClick={this.onAccept}
                                        tabIndex={2}
                                    />
                                </div>
                                :
                                <div className='buttonRow'>
                                    <Loading show={loading} onClose={this.handleClose.bind(this)}/>
                                    <Button
                                        id='BUTTON.REJECT'
                                        type={BUTTON_TYPE.DANGER}
                                        onClick={this.onReject}
                                        tabIndex={3}
                                    />
                                    <Button
                                        id='BUTTON.ACCEPT'
                                        onClick={this.onAcceptLedger}
                                        tabIndex={2}
                                    />
                                </div>
                        }
                    </div>

                }
            </div>
        );
    }
}

export default injectIntl(
    connect(state => ({
        type: state.accounts.selected.type,
        confirmation: state.confirmations[0]
    }))(ConfirmationController)
);

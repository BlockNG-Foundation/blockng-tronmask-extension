import React from 'react';
import { FormattedMessage, injectIntl } from 'react-intl';
import { PopupAPI } from '@tronmask/lib/api';
import Utils from '@tronmask/lib/utils';
import Toast, { T } from 'react-toast-mobile';
import { Switch, NoticeBar } from 'antd-mobile';
import TronWeb from 'tronweb';
import { get as lodashGet, debounce as lodashDebounce, size as lodashSize } from 'lodash';
import { mainNetList } from '@tronmask/lib/constants';

const trxImg = require('@tronmask/popup/src/assets/icon/trx.png');
const token10DefaultImg = require('@tronmask/popup/src/assets/icon/token_10_default.png');

class AssetManageController extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            address: {
                value: '',
                valid: false
            },
            allTokens: [],
            filterTokens: [],
            deleteToken: {
                show: false,
                tokenId: ''
            },
            mainNet: true
        };
        this.searchToken = this.searchToken.bind(this);
        this.debounceFunction = lodashDebounce(this.searchToken, 400).bind(this);
    }

    async componentDidMount() {
        const { chains, nodes } = this.props;
        if (!mainNetList.includes(nodes.selected)) {
            this.setState({ mainNet: false });
        } else {
            const allTokens = await PopupAPI.getAllTokens(chains.selected);
            this.setState({ allTokens: Utils.dataLetterSort(allTokens, 'abbr') });
        }
    }

    renderDeleteToken(tokens, deleteToken) {
        if (deleteToken.show) {
            const field = deleteToken.tokenId.match(/^T/) ? 'smart' : 'basic';
            const { imgUrl = false, name, abbr = false, symbol = false } = tokens[field][deleteToken.tokenId];
            return (
                <div className='deleteTokenWrap'>
                    <div className='deleteToken'>
                        <div className='title'>
                            <FormattedMessage id='ASSET.CONFIRM.HIDE_TOKEN'/>
                        </div>
                        <div className='icon'>
                            <img src={imgUrl ? imgUrl : token10DefaultImg}/>
                        </div>
                        <div className='name'>
                            {name}({abbr || symbol})
                        </div>
                        <div className='desc'>
                            <FormattedMessage id='ASSET.CONFIRM.CONTENT'/>
                        </div>
                        <div className='btnGroup'>
                            <button className='cancel' onClick={() => this.cancelDeleteToken()}>
                                <FormattedMessage id='ASSET.CONFIRM.CANCEL'/>
                            </button>
                            <button className='confirm' onClick={() => this.confirmDeleteToken()}>
                                <FormattedMessage id='ASSET.CONFIRM.HIDE'/>
                            </button>
                        </div>
                    </div>
                </div>
            );
        } else {
            return null;
        }
    }

    cancelDeleteToken() {
        const deleteToken = { show: false, tokenId: '' };
        this.setState({ deleteToken });
    }

    confirmDeleteToken() {
        const { selected } = this.props;
        const { deleteToken, filterTokens } = this.state;
        const { tokenId } = deleteToken;
        const field = tokenId.match(/^T/) ? 'smart' : 'basic';
        selected.tokens[field][tokenId].isLocked = true;
        const fs = filterTokens.map(({ tokenId: id, ...token }) => {
            if (id === tokenId) {
                token.isList = false;
            }
            return { tokenId: id, ...token };
        });
        this.setState({ filterTokens: fs, deleteToken: { show: false, tokenId: '' } });
        PopupAPI.updateTokens(selected.tokens);
    }

    async searchToken() {
        const { formatMessage } = this.props.intl;
        const { selected, vTokenList, chains } = this.props;
        const { address, mainNet } = this.state;
        const { allTokens } = this.state;

        const value = address.value;
        let fTokens = [];
        if (value !== '') {
            if (TronWeb.isAddress(value)) {
                const token = await PopupAPI.getSmartToken(value);
                if (!token) {
                    T.notify(formatMessage({ id: 'ERRORS.INVALID_TOKEN' }));
                    return;
                } else {
                    fTokens = allTokens.filter(({ tokenId }) => tokenId === value);
                    if (!fTokens.length) {
                        fTokens[0] = {
                            tokenId: value,
                            imgUrl: false,
                            name: token.name,
                            symbol: token.symbol,
                            decimals: token.decimals,
                            balance: token.balance,
                        };
                    } else {
                        fTokens[0].symbol = fTokens[0].abbr;
                    }
                    fTokens[0].isList = selected.tokens.smart.hasOwnProperty(value) && (!selected.tokens.smart[value].hasOwnProperty('isLocked') || !selected.tokens.smart[value].isLocked) ? true : false;
                }
            } else if (!mainNet && (/^\d+$/.test(value)) || (mainNet && /^\d{7}$/.test(value))) { // trc10
                const token = await PopupAPI.getTokenById(value);
                if (!token) {
                    T.notify(formatMessage({ id: 'ERRORS.INVALID_10_TOKEN' }));
                    return;
                } else {
                    fTokens = allTokens.filter(({ tokenId }) => tokenId === value);
                    if (lodashSize(fTokens) > 0) {
                        fTokens[0] = {
                            ...fTokens[0],
                            tokenId: value,
                            name: token.name,
                            symbol: token.symbol,
                            decimals: token.decimals,
                            balance: token.balance,
                        };
                    } else {
                        fTokens.push({
                            tokenId: value,
                            imgUrl: false,
                            name: token.name,
                            symbol: token.abbr,
                            decimals: token.precision || 0,
                            balance: 0,
                        });
                    }
                    fTokens[0].isList = selected.tokens.basic.hasOwnProperty(value) && (!selected.tokens.basic[value].hasOwnProperty('isLocked') || !selected.tokens.basic[value].isLocked) ? true : false;
                }
            } else if (mainNet) { // 只有主网才可以进行名称匹配
                let topArray2 = [];
                const regexp = new RegExp(value, 'i');
                fTokens = allTokens.filter(({ isBlack }) => !isBlack).filter(({ name, abbr }) => name.match(regexp) || abbr.match(regexp));
                fTokens = fTokens.map(({ tokenId, ...token }) => {
                    const field = tokenId.match(/^T/) ? 'smart' : 'basic';
                    let name = token.name;
                    if (token.name.match(regexp)) {
                        if (name.length > 18) {
                            let matchFirst = token.name.match(regexp)[0];
                            let temp = token.name.split(matchFirst);
                            let amendSize = matchFirst.length > 7
                                ? Math.abs(7 - matchFirst.length) > 6
                                    ? 6
                                    : Math.abs(7 - matchFirst.length)
                                : 0;
                            if (lodashSize(temp) > 2) {
                                for (let i = 2; i < lodashSize(temp); i++) {
                                    temp[1] += temp[i];
                                }
                                temp = temp.slice(0, 2);
                            }
                            if (lodashSize(temp[0]) > 7) {
                                temp[0] = temp[0].substring(0, 7 - amendSize) + '...';
                            }
                            if (lodashSize(temp[1]) > 7) {
                                temp[1] = '...' + temp[1].substring(temp[1].length - 7 + amendSize);
                            }
                            name = temp.join('<i>' + matchFirst + '</i>');
                        } else {
                            name = token.name.split(token.name.match(regexp)[0]).join('<i>' + token.name.match(regexp)[0] + '</i>');
                        }
                    }
                    // const name = token.name.match(regexp) ? token.name.split(token.name.match(regexp)[ 0 ]).join('<i>' + token.name.match(regexp)[ 0 ] + '</i>') : token.name;
                    const abbr = token.abbr.match(regexp) ? token.abbr.split(token.abbr.match(regexp)[0]).join('<i>' + token.abbr.match(regexp)[0] + '</i>') : token.abbr;
                    token.isList = selected.tokens[field].hasOwnProperty(tokenId) && (!selected.tokens[field][tokenId].hasOwnProperty('isLocked') || !selected.tokens[field][tokenId].isLocked) ? true : false;
                    token.html = `${name}(${abbr})`;
                    token.balance = selected.tokens[field].hasOwnProperty(tokenId) ? selected.tokens[field][tokenId].balance : 0;
                    token.isTop = false;
                    token.isVerify = vTokenList.includes(tokenId);
                    return { tokenId, ...token };
                });
                topArray2 = fTokens.filter(({ isVerify }) => isVerify);
                fTokens = Utils.dataLetterSort(fTokens, 'name', 'abbr', topArray2);
            }
        }
        this.setState({ filterTokens: fTokens });
    }

    render() {
        const { formatMessage } = this.props.intl;
        const { selected, onCancel, vTokenList, chains } = this.props;
        const { address, allTokens, filterTokens, deleteToken, mainNet } = this.state;
        const trx = {
            tokenId: '_',
            name: 'TRX',
            balance: (selected.balance + (selected.frozenBalance ? selected.frozenBalance : 0)),
            abbr: 'TRX',
            decimals: 6,
            imgUrl: trxImg,
            isTop: true
        };
        let tokens = { ...selected.tokens.basic, ...selected.tokens.smart };
        const topArray = [];
        tokens = Utils.dataLetterSort(Object.entries(tokens).filter(([tokenId, token]) => typeof token === 'object').map(v => {
            v[1].tokenId = v[0];
            return v[1];
        }).filter(v => v.balance > 0 || (v.balance == 0 && !v.isLocked)), 'abbr', 'symbol', topArray);
        tokens = [trx, ...tokens];
        tokens = tokens.filter(({ tokenId, ...token }) => !token.hasOwnProperty('chain') || token.chain === chains.selected).map(({ tokenId, ...token }) => {
            token.isTop = !!token.isTop;
            if (vTokenList.includes(tokenId)) {
                token.isVerify = true;
            }

            return { tokenId, ...token };
        });
        return (
            <div className='insetContainer asset scroll'>
                {this.renderDeleteToken(selected.tokens, deleteToken)}
                <div className='pageHeader'>
                    <div className='back' onClick={onCancel}></div>
                    <FormattedMessage id='ASSET.ASSET_MANAGE'/>
                </div>
                <div className='greyModal'>
                    {
                        mainNet ? null :
                            <NoticeBar marqueeProps={{ loop: true, style: { padding: '0 20px 0 0' } }}>
                                <FormattedMessage id='NOTIFICATIONS.TEST_NET.ASSET.TIP'/>
                            </NoticeBar>
                    }
                    <Toast/>
                    <div className='title'>
                        <FormattedMessage id='ASSET.ADD_TOKEN'/>
                    </div>
                    <div className={'input' + (address.value === '' ? '' : ' hasValue')}>
                        <input type='text' onChange={(e) => {
                            const value = e.target.value;
                            this.setState({ address: { value } });
                            this.debounceFunction();
                        }} placeholder={formatMessage({ id: 'ASSET.ADD_TOKEN.PLACEHOLDER' })}/>
                    </div>
                    <div className='leftSpace scroll'>
                        <div className='cellWrap'>
                            {
                                filterTokens.map(({ tokenId, symbol = false, abbr = '', imgUrl, name, isList = false, html = `${name}(${abbr})`, decimals, balance = 0, isVerify = false, isTop = false }) => {
                                    return (
                                        <div className='cell'>
                                            <img src={imgUrl ? imgUrl : token10DefaultImg} onError={(e) => {
                                                e.target.src = token10DefaultImg;
                                            }}/>
                                            <div className='desc'>
                                                <div className={'row1' + (isVerify ? ' isVerify' : '')}
                                                     dangerouslySetInnerHTML={{ __html: html }}></div>
                                                <div className='row2'>
                                                    {tokenId.match(/^T/) ? 'contract' : 'ID'} : {tokenId.match(/^T/) ? tokenId.substr(0, 7) + '...' + tokenId.substr(-7) : tokenId}
                                                </div>
                                            </div>
                                            {
                                                isTop ?
                                                    null
                                                    :
                                                    <Switch color='#F7861C' checked={isList} onClick={(e) => {
                                                        const field = tokenId.match(/^T/) ? 'smart' : 'basic';
                                                        const filters = filterTokens.map(({ tokenId: id, ...token }) => {
                                                            if (id === tokenId) {
                                                                token.isList = !isList;
                                                            }
                                                            return { tokenId: id, ...token };
                                                        });
                                                        this.setState({ filterTokens: filters });
                                                        if (!isList) {
                                                            const token = {
                                                                name,
                                                                imgUrl,
                                                                balance,
                                                                isLocked: false,
                                                                decimals,
                                                            };
                                                            //const key = TronWeb.isAddress(address.value) && !selected.tokens.smart.hasOwnProperty(address.value) ? 'symbol' : 'abbr';
                                                            const key = 'symbol';
                                                            token[key] = abbr || symbol;
                                                            if (field === 'smart') {
                                                                token.chain = chains.selected;
                                                            }
                                                            selected.tokens[field][tokenId] = token;
                                                        } else {
                                                            selected.tokens[field][tokenId].isLocked = true;
                                                        }
                                                        PopupAPI.updateTokens(selected.tokens);
                                                    }}/>

                                            }
                                        </div>
                                    );
                                })
                            }
                        </div>
                        <div className='title' style={{ marginTop: '20px' }}>
                            <FormattedMessage id='ASSET.MY_ASSET'/>
                        </div>
                        <div className='cellWrap'>
                            {
                                tokens.map(({ tokenId, symbol, abbr, imgUrl, name, isLocked = false, balance, isVerify = false, isTop = false }) => (
                                    <div className='cell'>
                                        <img src={imgUrl ? imgUrl : token10DefaultImg} onError={(e) => {
                                            e.target.src = token10DefaultImg;
                                        }}/>
                                        <div className='desc'>
                                            <div className='row1'>
                                                <span>{name.length > 16 ? name.substring(0, 8) + '...' + name.substring(name.length - 8) : name}({abbr || symbol})</span>
                                                {
                                                    isVerify
                                                        ?
                                                        <img
                                                            src={require('@tronmask/popup/src/assets/icon/icon-verify.svg')}/>
                                                        :
                                                        null
                                                }
                                            </div>
                                            {
                                                tokenId === '_'
                                                    ?
                                                    null
                                                    :
                                                    <div className='row2'>
                                                        {tokenId.match(/^T/) ? 'contract' : 'ID'}:{tokenId.match(/^T/) ? tokenId.substr(0, 7) + '...' + tokenId.substr(-7) : tokenId}
                                                    </div>
                                            }
                                        </div>
                                        {
                                            !isTop ?
                                                <Switch color='#F7861C' checked={!isLocked} onClick={(e) => {
                                                    const field = tokenId.match(/^T/) ? 'smart' : 'basic';
                                                    if (balance > 0) {
                                                        selected.tokens[field][tokenId].isLocked = !isLocked;
                                                        if (filterTokens.length) {
                                                            const fs = filterTokens.map(({ tokenId: id, ...token }) => {
                                                                if (id === tokenId) {
                                                                    token.isList = isLocked;
                                                                }
                                                                return { tokenId: id, ...token };
                                                            });
                                                            this.setState({ filterTokens: fs });
                                                        }
                                                    } else {
                                                        this.setState({ deleteToken: { show: true, tokenId } });
                                                    }
                                                    PopupAPI.updateTokens(selected.tokens);
                                                }}/>
                                                :
                                                null
                                        }
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default injectIntl(AssetManageController);

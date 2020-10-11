import React from 'react';
import { injectIntl } from 'react-intl';
import { Toast } from 'antd-mobile';
import ReactTooltip from 'react-tooltip';
import { APP_STATE } from '@tronmask/lib/constants';
import { PopupAPI } from '@tronmask/lib/api';


class Header extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            nodeIndex: 0,
            refresh: false,
            cssPre: {},
        };
    }

    async componentDidMount() {

    }

    generateMenu() {
        const { formatMessage } = this.props.intl;
        const { refresh } = this.state;

        return <div>
            <div className="linkWrap" style={{ 'border-right': '0' }}>
                <div className="fun" data-tip={formatMessage({ id: 'INDEX_ICON_TITLE.LOCK' })} data-for='lock'
                     onClick={() => {
                         PopupAPI.lockWallet();
                     }}>&nbsp;</div>
                <ReactTooltip id='lock' effect='solid'/>
                <div className="fun" data-tip={formatMessage({ id: 'INDEX_ICON_TITLE.REFRESH' })} data-for='refresh'
                     onClick={() => {
                         if (!refresh) {
                             this.setState({ refresh: true }, async () => {
                                 Toast.loading();
                                 const r = await PopupAPI.refresh();
                                 if (r) {
                                     this.setState({ refresh: false });
                                     Toast.hide();
                                 }
                             });
                         }
                     }}
                >&nbsp;</div>
                <ReactTooltip id='refresh' effect='solid'/>
                <div className="fun" data-tip={formatMessage({ id: 'INDEX_ICON_TITLE.SETTING' })} data-for='set'
                     onClick={() => {
                         PopupAPI.changeState(APP_STATE.SETTING);
                     }}>&nbsp;</div>
                <ReactTooltip id='set' effect='solid'/>
            </div>
        </div>;
    }

    render() {
        const {
            handleSelectChain,
            showChainList,
            chains,
            handleShowChainList
        } = this.props;
        return (
            <div className='header'>
                <div className='titleContainer'>
                    <div
                        className={'selectedChain ' + (chains.selected === '_' ? 'selected1' : 'selected2') + (showChainList ? ' showList' : '')}
                        onClick={handleShowChainList}>
                        <span>{chains.chains[chains.selected].name}</span>
                        <div className='chainWrap' style={showChainList ? { height: 100 } : { height: 0 }}>
                            {
                                Object.entries(chains.chains).map(([chainId, { name }]) => {
                                    return <div className={'item ' + (chains.selected === chainId ? 'checked' : '')}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelectChain(chainId);
                                                }}>
                                        <div className="content">{name}</div>
                                    </div>;
                                })
                            }
                        </div>
                    </div>
                    {
                        this.generateMenu()
                    }
                </div>
            </div>
        );
    }
}

export default injectIntl(Header);

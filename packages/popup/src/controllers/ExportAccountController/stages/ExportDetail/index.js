import React from 'react';
import Button from '@tronmask/popup/src/components/Button';
import { TextareaItem, Toast, Modal } from 'antd-mobile';
import { connect } from 'react-redux';
import { FormattedMessage, injectIntl } from 'react-intl';
import {encrypt} from '@tronmask/lib/keystore'
import QRCode from 'qrcode.react';

import './ExportDetail.scss';
import { APP_STATE, EXPORT_STAGE } from '@tronmask/lib/constants';
import { PopupAPI } from '@tronmask/lib/api';
import CopyToClipboard from 'react-copy-to-clipboard';

class PrivateKeyImport extends React.Component {
    constructor() {
        super();
        this.state = {
            privateKey: '',
            keystoreStr: '',
            mnemonic: '',
            type:'',
            showQR: false,
        };
    }

    async componentDidMount() {
        const {type, account, password} = this.props;
        console.log(type, account, password)
        if(type === EXPORT_STAGE.EXPORT_KEY_STORE){
            Toast.loading('', 5);
            const keystoreStr = await encrypt(account, password)
            Toast.hide();
            this.setState({keystoreStr})
        }
        this.setState({mnemonic: account.mnemonic, privateKey: account.privateKey, type: type})
        setTimeout(() => {
            document.getElementById("customText") && document.getElementById("customText").focus();
        }, 0)
    }

    buildContent(){
        const { formatMessage } = this.props.intl;
        const {privateKey, keystoreStr, mnemonic, type} = this.state;
        if(type === EXPORT_STAGE.EXPORT_MNEMONIC){
            return <div className="content">
                <div className='wordList'>
                    { mnemonic.split(' ').map((word, index) => (
                        <div className='word' key={ index }>
                            <div className="seq">{index+1}</div>
                            { word.trim() }
                        </div>
                    )) }
                </div>
                <div className='buttonWrap'>
                    <CopyToClipboard text={mnemonic} onCopy={(e) => {
                        Toast.info(formatMessage({ id: 'TOAST.COPY' }), 2);
                    }}>
                        <div className='copy'><FormattedMessage id="BUTTON.COPY" /></div>
                    </CopyToClipboard>
                    <div className="line"> </div>
                    <div className='qrcode' onClick={()=>{this.setState({showQR: true})}}> <FormattedMessage id="BUTTON.QR_CODE" /></div>
                </div>
            </div>
        } else {
            let content = privateKey
            if(type === EXPORT_STAGE.EXPORT_KEY_STORE){
                content = keystoreStr
            }
            return <div className="content">
                <TextareaItem id="customText"
                    className='showContent'
                    value={content}
                    editable="false"
                    autoHeight
                    count={0}
                />
                <div className='buttonWrap'>
                    <CopyToClipboard text={content} onCopy={(e) => {
                        Toast.info(formatMessage({ id: 'TOAST.COPY' }), 2);
                    }}>
                        <div className='copy'><FormattedMessage id="BUTTON.COPY" /></div>
                    </CopyToClipboard>
                    <div className="line"> </div>
                    <div className='qrcode' onClick={()=>{this.setState({showQR: true})}}> <FormattedMessage id="BUTTON.QR_CODE" /></div>
                </div>
            </div>
        }
    }

    buildQRcode(){
        const { formatMessage } = this.props.intl;
        const {privateKey, keystoreStr, mnemonic, type, showQR} = this.state;
        if(showQR){
            let codeValue = '';
            switch (type) {
                case EXPORT_STAGE.EXPORT_MNEMONIC:
                    codeValue = mnemonic;
                    break;
                case EXPORT_STAGE.EXPORT_PRIVATE_KEY:
                    codeValue = privateKey;
                    break;
                case EXPORT_STAGE.EXPORT_KEY_STORE:
                    codeValue = keystoreStr;
                    break;
            }
            return  <Modal
                    visible="true"
                    transparent
                    maskClosable={false}
                    onClose={()=>{this.setState({showQR: false})}}
                    title={formatMessage({id:'CREATION.EXPORT.' + (type === EXPORT_STAGE.EXPORT_MNEMONIC ? "MNEMONIC"
                            : (type === EXPORT_STAGE.EXPORT_PRIVATE_KEY ? "PRIVATE_KEY" : "KEYSTORE"))  +'.QR_CODE'})}
                    // footer={[{ text: formatMessage({id:'BUTTON.CLOSE'}), onPress: ()=>{this.setState({showQR: false})} }]}
                    afterClose={() => { alert('afterClose'); }}
                >
                <QRCode
                    value={codeValue}
                    renderAs="svg"
                    // level="H"
                    size="160"
                />
                <div className="footer">
                    <Button id='BUTTON.CLOSE'
                            onClick={ ()=>{this.setState({showQR: false})} }
                            tabIndex={ 1 }>
                    </Button>
                </div>
                </Modal>
        }
        return null;
    }

    render() {
        const { onCancel } = this.props;
        const {type} = this.state

        return (
            <div className='insetContainer exportDetail'>
                <div className='pageHeader'>
                    <div className="back" onClick={ onCancel }></div>
                    <FormattedMessage id={type === EXPORT_STAGE.EXPORT_MNEMONIC ? "CREATION.EXPORT.MNEMONIC.TITLE"
                        : (type === EXPORT_STAGE.EXPORT_PRIVATE_KEY ? "CREATION.EXPORT.PRIVATE_KEY.TITLE" : "CREATION.EXPORT.KEYSTORE.TITLE")} />
                </div>
                <div className='greyModal'>
                    {
                        this.buildQRcode()
                    }
                    <div className='exportDesc'>
                        <FormattedMessage id={"CREATION.EXPORT."+ (type === EXPORT_STAGE.EXPORT_MNEMONIC ? "MNEMONIC"
                            : (type === EXPORT_STAGE.EXPORT_PRIVATE_KEY ? "PRIVATE_KEY" : "KEYSTORE")) +".TIP"} />
                    </div>
                    {
                        this.buildContent()
                    }
                    <div className='buttonRow'>
                        <Button
                            id='BUTTON.BACKUP'
                            onClick={ () => PopupAPI.changeState(APP_STATE.READY) }
                            tabIndex={ 2 }
                        />
                    </div>
                </div>
            </div>
        );
    }
}

export default injectIntl(connect(state => ({
    accounts: state.accounts.accounts
}))(PrivateKeyImport));

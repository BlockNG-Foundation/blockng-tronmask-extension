import React from 'react';
import Button from '@tronmask/popup/src/components/Button';
import Utils from '@tronmask/lib/utils';
import { connect } from 'react-redux';
import { TextareaItem, Toast } from 'antd-mobile';
import { FormattedMessage, injectIntl } from 'react-intl';
import { PopupAPI } from '@tronmask/lib/api';
import { bytesToString } from '@tronscan/client/src/utils/bytes';
import { hexStr2byteArray } from '@tronscan/client/src/lib/code';
import { pkToAddress } from '@tronscan/client/src/utils/crypto';
import { debounce as lodashDebounce } from 'lodash';
import { isKeystoreWallet, decryptSync, isTronscanKeystore } from '@tronmask/lib/keystore';

import './KeystoreImport.scss';

const uploadImg = require('@tronmask/popup/src/assets/icon/icon-upload2.svg');

class KeystoreImport extends React.Component {
    constructor() {
        super();
        this.state = {
            isValid: false,
            isLoading: false,
            error: '',
            selectedFile: {
                show: false,
                name: '',
                contents: ''
            },
            fileName: '',
            keyStoreContent: '',
            contentValid: true,
            errorTipId: '',
            password: ''
        };
        this.debounceFunction = lodashDebounce(this.validContent, 500, { 'maxWait': 1000 }).bind(this);
    }

    checkTronscanKeystore(contents) {
        const { formatMessage } = this.props.intl;
        try {
            const jsonStr = bytesToString(hexStr2byteArray(contents));
            if(isTronscanKeystore(jsonStr)){
                return jsonStr
            }
            throw new Error('not keystore')
        } catch (e) {
            Toast.fail(formatMessage({ id: 'CREATION.RESTORE.KEY_STORE.EXCEPTION.FILE_ERROR' }), 3);
            return false;
        }
    }

    validContent() {
        const { keyStoreContent } = this.state;
        this.setState({ errorTipId: false });
        try {
            if (keyStoreContent === '' || isKeystoreWallet(keyStoreContent) || isTronscanKeystore(keyStoreContent)) {
                this.setState({ contentValid: true });
            } else {
                this.setState({ contentValid: false });
            }
        } catch (e) {
            this.setState({ contentValid: false });
        }
    }

    async unlockKeyFile() {
        // console.log('gotootoototo')
        this.setState({ isLoading: true });
        const { password, keyStoreContent } = this.state;
        let errorTipId = false;
        try {
            let keyStoreContentObj = JSON.parse(keyStoreContent);
            // console.log('keyStoreContentObj:', keyStoreContentObj)
            const { key, address, salt, version } = keyStoreContentObj;
            if (key && address && salt || +version === 1) { // first tronscan try
                // console.log(key, address, salt, version)
                const privateKey = Utils.decryptString(password, salt, key);
                await this.addAccount(address, privateKey);
            } else if (isKeystoreWallet(keyStoreContent)) {//standard
                const { address, privateKey } = await decryptSync(keyStoreContent, password);
                // console.log(address, privateKey);
                await this.addAccount(address, privateKey);
            } else {
                // not support
                errorTipId = 'CREATION.RESTORE.KEY_STORE.EXCEPTION';
            }
        } catch (e) {
            console.log('err:', e)
            this.setState({ isLoading: false });
            errorTipId = 'CREATION.RESTORE.KEY_STORE.EXCEPTION';
        } finally {
            this.setState({ errorTipId });
        }
        return true
    }

    async addAccount(address, privateKey) {
        const { formatMessage } = this.props.intl;
        const { name, accounts } = this.props;
        if (Utils.validatePrivateKey(privateKey) && pkToAddress(privateKey) === address) {
            if (address in accounts) {
                Toast.fail(formatMessage({ id: 'CREATION.RESTORE.KEY_STORE.EXCEPTION.ACCOUNT_EXIST' }), 3, () => {
                    this.setState({ isLoading: false });
                });
            } else {
                const res = await PopupAPI.importAccount(privateKey, name);
                if (res) {
                    Toast.info(formatMessage({ id: 'CREATION.RESTORE.KEY_STORE.ADD_SUCCESS' }), 1, () => {
                        this.setState({ isLoading: false });
                        PopupAPI.resetState();
                    });
                }
            }
        } else {
            throw new Error('addAccount error')
        }
    }

    render() {
        const { selectedFile, password, isLoading, keyStoreContent, contentValid, errorTipId, fileName } = this.state;
        const { formatMessage } = this.props.intl;
        const { onCancel } = this.props;
        return (
            <div className='insetContainer keystoreImport'>
                <div className='pageHeader'>
                    <div className='back' onClick={() => onCancel()}></div>
                    <FormattedMessage id='CHOOSING_TYPE.KEY_STORE_PAGE.TITLE'/>
                </div>
                <div className='greyModal scroll'>
                    <div className="titleWrap">
                        <div className='title'>
                            <FormattedMessage id='CREATION.RESTORE.KEY_STORE.INPUT.TITLE'/>
                        </div>
                        <div className='uploadWrap'>
                            <input type='file' ref='file' accept='.txt' onChange={async (e) => {
                                if (e.target.value.endsWith('.txt')) {
                                    const files = e.target.files;
                                    const contents = await Utils.readFileContentsFromEvent(e);
                                    const name = files[0].name.length > 28 ? files[0].name.substr(0, 10) + '...' + files[0].name.substr(-18, 10) + '.txt' : files[0].name;
                                    const decodeContents = this.checkTronscanKeystore(contents);
                                    this.refs.file.value = '';
                                    if (decodeContents) {
                                        this.setState({
                                            keyStoreContent: decodeContents,
                                            contentValid: true,
                                            fileName: name
                                        });
                                    }
                                }
                            }}/>
                            <img src={uploadImg} alt="icon"/>
                            <div className='text'>
                                <FormattedMessage id='CREATION.RESTORE.KEY_STORE.SELECT_FILE'/>
                            </div>
                        </div>
                    </div>
                    <div>
                        {
                            fileName ?
                                <div className='selectedFile'>
                                    <span>{fileName}</span>
                                </div>
                                :
                                null
                        }
                        <TextareaItem
                            className={'content ' + ( !contentValid ? 'errorWrap' : '')}
                            value={keyStoreContent}
                            onChange={(e) => {
                                this.setState({ keyStoreContent: e, fileName: '' });
                                this.debounceFunction();
                            }}
                            placeholder={formatMessage({ id: 'CREATION.RESTORE.KEY_STORE.INPUT.TIPS' })}
                            rows={10}
                            count={0}
                        />
                        <div className='tipError'>
                            { !contentValid ?
                                <FormattedMessage id='CREATION.RESTORE.KEY_STORE.EXCEPTION.FILE_ERROR'/> : null}
                        </div>
                    </div>
                    <div className='passwordWrap'>
                        <div className='password'>
                            <label className="titleWrap">
                                <FormattedMessage id='CREATION.RESTORE.KEY_STORE.INPUT_PASSWORD'/>
                            </label>
                            <input type="password" className={(errorTipId ? 'errorWrap' : '')}
                                   placeholder={formatMessage({ id: 'CREATION.RESTORE.KEY_STORE.INPUT_PASSWORD.TIPS' })}
                                   onChange={e => this.setState({ password: e.target.value, errorTipId: false })}/>
                            <div className='tipError'>
                                {errorTipId ?
                                    <FormattedMessage id={errorTipId}/> : null}
                            </div>
                        </div>
                        <Button id='CREATION.RESTORE.TITLE' isLoading={isLoading}
                                isValid={contentValid && password}
                                onClick={() => this.unlockKeyFile()}/>
                    </div>
                </div>
            </div>
        );
    }
}

export default injectIntl(connect(state => ({
    accounts: state.accounts.accounts
}))(KeystoreImport));

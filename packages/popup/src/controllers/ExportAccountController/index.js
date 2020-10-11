import React from 'react';
import { PopupAPI } from '@tronmask/lib/api';
import { EXPORT_STAGE } from '@tronmask/lib/constants';

import ChoosingType from './stages/ChoosingType';
import ExportDetail from './stages/ExportDetail';
import{size as lodashSize} from 'lodash'

import './ExportAccountController.scss';
import { Toast } from 'antd-mobile';

class RestoreAccountController extends React.Component {

    constructor() {
        super();
        this.state= {
            stage: EXPORT_STAGE.CHOOSING_TYPE,
            walletName: false,
            account: {
                mnemonic: '',
                privateKey: '',
                address: ''
            },
            type: '',
            password: ''
        }
        this.handleNameSubmit = this.handleNameSubmit.bind(this);
        this.changeStage = this.changeStage.bind(this);
    }

    async componentDidMount() {
        Toast.loading('', 1);
        const {
            mnemonic,
            privateKey
        } = await PopupAPI.exportAccount();
        const password = await PopupAPI.getWalletPassword();
        const { selected } = this.props.accounts;
        this.setState({
            account: {
                mnemonic,
                privateKey,
                address: selected.address
            },
            password: password
        })
        Toast.hide();
    }

    handleNameSubmit(name) {
        this.setState({
            stage: EXPORT_STAGE.CHOOSING_TYPE,
            walletName: name.trim()
        });
    }

    changeStage(newStage) {
        console.log(newStage);
        if(newStage === EXPORT_STAGE.CHOOSING_TYPE){
            this.setState({
                stage: newStage
            })
        }else{
            this.setState({
                stage: EXPORT_STAGE.EXPORT_PAGE,
                type: newStage
            });
        }
    }

    render() {
        const {
            stage,
            type,
            account,
            password
        } = this.state;
        switch(stage) {
            case EXPORT_STAGE.CHOOSING_TYPE:
                return (
                    <ChoosingType
                        hasMnemonic={lodashSize(account.mnemonic) > 0}
                        onSubmit={ importType => this.changeStage(importType) }
                        onCancel={ () => PopupAPI.resetState() }
                    />
                );
            case EXPORT_STAGE.EXPORT_PAGE:
                return (
                    <ExportDetail
                        type={ type }
                        account={account}
                        password={password}
                        onCancel={ () => this.changeStage(EXPORT_STAGE.CHOOSING_TYPE) }
                    />
                );
            default:
                return null;
        }
    }
}

export default RestoreAccountController;

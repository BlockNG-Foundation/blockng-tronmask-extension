import React from 'react';

import { FormattedMessage } from 'react-intl';

import {
    EXPORT_STAGE
} from '@tronmask/lib/constants';

const ChoosingType = props => {
    const {
        hasMnemonic,
        onSubmit,
        onCancel
    } = props;

    return (
        <div className='insetContainer choosingType'>
            <div className='pageHeader'>
                <div className='back' onClick={ onCancel }></div>
                <FormattedMessage id="CHOOSING_TYPE.EXPORT.TITLE" />
            </div>
            <div className='greyModal'>
                {
                    hasMnemonic ?
                        <div className='option' onClick={() => {
                            onSubmit(EXPORT_STAGE.EXPORT_MNEMONIC);
                        }}>
                            <FormattedMessage id='CHOOSING_TYPE.MNEMONIC.TITLE'/>
                        </div>
                        : null
                }

                <div className='option' onClick={ () => {
                    onSubmit(EXPORT_STAGE.EXPORT_PRIVATE_KEY);
                }}>
                    <FormattedMessage id='CHOOSING_TYPE.PRIVATE_KEY.TITLE' />
                </div>
                <div className='option' onClick={ () => {
                    onSubmit(EXPORT_STAGE.EXPORT_KEY_STORE);
                } }>
                    <FormattedMessage id='CHOOSING_TYPE.KEY_STORE.TITLE' />
                </div>
            </div>
        </div>
    );
};

export default ChoosingType;

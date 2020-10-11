export const APP_STATE = {
    // Wallet is migrating / not unlocked
    UNINITIALISED: 0, // [x] First user creates password
    PASSWORD_SET: 1, // [x] Password is set, but the wallet is locked. Next step is UNLOCKED

    // Wallet is unlocked
    UNLOCKED: 2, // [x] User is given two options - restore account or create new account
    CREATING: 3, // [x] Shown if a user is creating a new account (startup or in general). Next step is READY
    RESTORING: 4, // [x] Shown when the user is restoring (or in general importing) an account. Next step is READY

    // Wallet is functional
    READY: 5, // [x] User is logged in (and at least 1 account exists)
    REQUESTING_CONFIRMATION: 6, // [x] Shown if confirmations are queued
    RECEIVE: 7, //[x] Show if need to accept trx or tokens
    SEND: 8, //[x] Show if need to send trx or tokens
    TRANSACTIONS: 9, //[x] Show transactions record
    SETTING: 10, //[x] Show setting
    ADD_TRC20_TOKEN: 11, //[x] Show setting
    TRONBANK: 12, // [x] show TronBank page
    TRONBANK_RECORD: 13, //[x] show TronBankRecord page
    TRONBANK_DETAIL: 14, //[X] show TronBankDetail page
    TRONBANK_HELP: 15,
    USDT_INCOME_RECORD: 16, //[X] income record for usdt
    USDT_ACTIVITY_DETAIL: 17,
    DAPP_LIST: 18, // [X]show dapp list
    ASSET_MANAGE: 19, // [X]asset manage
    TRANSACTION_DETAIL: 20, // [X] transaction detail
    DAPP_WHITELIST: 21, // [X] transaction detail
    LEDGER: 22, // [X] connect ledger wallet
    LEDGER_IMPORT_ACCOUNT: 23, // [X] connect ledger wallet
    NODE_MANAGE:24, // node manage
    TRANSFER:25, // transfer
    ADDRESS_BOOK:26, // ADDRESS_MANAGE
    ADDRESS_BOOK_DETAIL:27, // ADDRESS_MANAGE
    EXPORT_ACCOUNT: 29,
}; // User can delete *all* accounts. This will set the appState to UNLOCKED.

export const ACCOUNT_TYPE = {
    MNEMONIC: 0,
    PRIVATE_KEY: 1,
    LEDGER:2
};

export const VALIDATION_STATE = {
    NONE: 'no-state',
    INVALID: 'is-invalid',
    VALID: 'is-valid'
};

export const CREATION_STAGE = {
    SETTING_NAME: 0,
    WRITING_PHRASE: 1,
    CONFIRMING_PHRASE: 2,
    SUCCESS: 3
};

export const RESTORATION_STAGE = {
    SETTING_NAME: 0,
    CHOOSING_TYPE: 1,
    IMPORT_PRIVATE_KEY: 2,
    IMPORT_TRONWATCH_LEGACY: 3,
    IMPORT_TRONSCAN: 4,
    IMPORT_MNEMONIC: 5,
    IMPORT_KEY_STORE: 7,
    SUCCESS: 6
};

export const EXPORT_STAGE = {
    CHOOSING_TYPE: 1,
    EXPORT_PAGE: 2,
    EXPORT_PRIVATE_KEY: 3,
    EXPORT_MNEMONIC: 4,
    EXPORT_KEY_STORE: 5,
}

export const BUTTON_TYPE = {
    PRIMARY: 'primary',
    SECONDARY: 'secondary',
    SUCCESS: 'success',
    DANGER: 'danger',
    WHITE: 'white'
};

export const PAGES = {
    ACCOUNTS: 0,
    TRANSACTIONS: 1,
    TOKENS: 2,
    SEND: 3,
    SETTINGS: 4
};

export const SUPPORTED_CONTRACTS = [
    'TransferContract',
    'TransferAssetContract',
    'FreezeBalanceContract',
    'UnfreezeBalanceContract',
    'TriggerSmartContract'
];

export const CONFIRMATION_TYPE = {
    STRING: 0,
    TRANSACTION: 1
};

export const CONTRACT_ADDRESS = {
    USDT:"TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    MAIN:"TL9q7aDAHYbW5KdPCwk8oJR3bCDhRwegFf",
    SIDE:"TGKotco6YoULzbYisTBuP6DWXDjEgJSpYz",
    MAIN_TEST:"TFLtPoEtVJBMcj6kZPrQrwEdM3W3shxsBU", //testnet mainchain
    SIDE_TEST:"TRDepx5KoQ8oNbFVZ5sogwUxtdYmATDRgX", //testnet sidechain
    MAIN_TEST_NILE: "TTYtjySdWFkZeUnQEB7cfwyxj3PD2ZsEmd",
    SIDE_TEST_NILE: "TWLoD341FRJ43JfwTPADRqGnUT4zEU3UxG",
};

export const TOP_TOKEN = {
    mainchain:[
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        '1002000',
        'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7',
        'TMwFHYXLJaRUPeW6421aqXL4ZEzPRFGkGT',
        'TCFLL5dx5ZJdKnWuesXxi1VPwjLVmWZZy9'
    ],
    sidechain:['1002000']
};

export const SIDE_CHAIN_ID = '41E209E4DE650F0150788E8EC5CAFA240A23EB8EB7';
export const SIDE_CHAIN_ID_TEST = '413AF23F37DA0D48234FDD43D89931E98E1144481B';
export const SIDE_CHAIN_ID_TEST_NILE = '41C0D909CC323543142E77AAD3786389364B981EEC';

export const NODE = {
    MAIN: {fullNode: 'https://api.trongrid.io', solidityNode: 'https://api.trongrid.io', eventServer: 'https://api.trongrid.io'},
    SIDE: {fullNode: 'https://sun.tronex.io', solidityNode: 'https://sun.tronex.io', eventServer: 'https://sun.tronex.io'}
};
export const FEE = {
    WITHDRAW_FEE:0,
    DEPOSIT_FEE:0,
    FEE_LIMIT:100000000,
    MIN_DEPOSIT_OR_WITHDRAW:10000000
};

export const mainNetList = ['109c64ad-e59c-46fe-ba87-179587e6c772', '8eeb5be6-5e10-4283-ae61-03c0e4726fe0', '51a36e5a-2480-4b57-989c-539345a13be2'];

export const REFER_ABI = [{
    'constant': true,
    'inputs': [],
    'name': 'name',
    'outputs': [{ 'name': '', 'type': 'string' }],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function'
}, {
    'constant': false,
    'inputs': [{ 'name': 'spender', 'type': 'address' }, { 'name': 'value', 'type': 'uint256' }],
    'name': 'approve',
    'outputs': [{ 'name': '', 'type': 'bool' }],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function'
}, {
    'constant': false,
    'inputs': [{ 'name': 'from', 'type': 'address' }, { 'name': 'to', 'type': 'address' }, {
        'name': 'value',
        'type': 'uint256'
    }],
    'name': 'transferFrom',
    'outputs': [{ 'name': '', 'type': 'bool' }],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function'
}, {
    'constant': true,
    'inputs': [],
    'name': 'decimals',
    'outputs': [{ 'name': '', 'type': 'uint8' }],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function'
}, {
    'constant': true,
    'inputs': [{ 'name': 'owner', 'type': 'address' }],
    'name': 'balanceOf',
    'outputs': [{ 'name': '', 'type': 'uint256' }],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function'
}, {
    'constant': true,
    'inputs': [],
    'name': 'symbol',
    'outputs': [{ 'name': '', 'type': 'string' }],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function'
}, {
    'constant': false,
    'inputs': [{ 'name': 'to', 'type': 'address' }, { 'name': 'value', 'type': 'uint256' }],
    'name': 'transfer',
    'outputs': [{ 'name': '', 'type': 'bool' }],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function'
}, {
    'inputs': [{ 'name': 'name', 'type': 'string' }, { 'name': 'symbol', 'type': 'string' }, {
        'name': 'decimals',
        'type': 'uint8'
    }], 'payable': false, 'stateMutability': 'nonpayable', 'type': 'constructor'
}, {
    'anonymous': false,
    'inputs': [{ 'indexed': true, 'name': 'from', 'type': 'address' }, {
        'indexed': true,
        'name': 'to',
        'type': 'address'
    }, { 'indexed': false, 'name': 'value', 'type': 'uint256' }],
    'name': 'Transfer',
    'type': 'event'
}];

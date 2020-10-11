export default {
    currentAccount: false,

    init(duplex) {
        this.duplex = duplex;
    },

    setState(appState) {
        this.duplex.send('popup', 'setState', appState, false);
    },

    setAccount(account) {
        this.duplex.send('popup', 'setAccount', account, false);

        if(this.currentAccount === account)
            return;
        const { address, name , type } = account;
        this.duplex.send('tab', 'tunnel', {
            action: 'setAccount',
            data: { address, name, type }
        }, false);

        this.currentAccount = account;
    },

    setNode(node) {
        this.duplex.send('tab', 'tunnel', {
            action: 'setNode',
            data: node
        }, false);
    },

    setChain(chain){
        this.duplex.send('popup', 'setChain', chain, false);
        this.duplex.send('tab', 'tunnel', {
            action: 'setChain',
            data: chain
        }, false);
    },

    setAccounts(accounts) {
        this.duplex.send('popup', 'setAccounts', accounts, false);
    },

    setPriceList(priceList) {
        this.duplex.send('popup', 'setPriceList', priceList, false);
    },

    setConfirmations(confirmationList) {
        this.duplex.send('popup', 'setConfirmations', confirmationList, false);
    },

    setCurrency(currency) {
        this.duplex.send('popup', 'setCurrency', currency, false);
    },

    setSelectedToken(token) {
        this.duplex.send('popup', 'setSelectedToken', token, false);
    },

    setLanguage(language) {
        this.duplex.send('popup', 'setLanguage', language, false);
    },

    setSetting(setting) {
        this.duplex.send('popup', 'setSetting', setting, false);
    },

    setAuthorizeDapps(dappList) {
        this.duplex.send('popup', 'setAuthorizeDapps',dappList ,false);
    },

    setVTokenList(vTokenList) {
        this.duplex.send('popup', 'setVTokenList',vTokenList ,false);
    },

    setResource(resource) {
        this.duplex.send('popup', 'setResource',resource ,false);
    },

    setNodes(nodes) {
        this.duplex.send('popup', 'setNodes',nodes ,false);
    }

};


export default {
    init(duplex) {
        this.duplex = duplex;
    },

    //Data refresh
    refresh() {
        return this.duplex.send('refresh');
    },
    // Data requesting

    requestState() {
        return this.duplex.send('requestState');
    },

    changeState(appState) {
        return this.duplex.send('changeState', appState, false);
    },

    resetState() {
        return this.duplex.send('resetState', {}, false);
    },

    getConfirmations() {
        return this.duplex.send('getConfirmations');
    },

    // Confirmation actions

    acceptConfirmation(whitelistDuration, signedTransaction) {
        return this.duplex.send('acceptConfirmation', {whitelistDuration, signedTransaction}, false);
    },

    rejectConfirmation() {
        return this.duplex.send('rejectConfirmation', {}, false);
    },

    // Transaction handling

    sendTrx(recipient, amount, note) {
        return this.duplex.send('sendTrx', { recipient, amount, note });
    },

    sendBasicToken(recipient, amount, token, note) {
        return this.duplex.send('sendBasicToken', { recipient, amount, token, note });
    },

    sendSmartToken(recipient, amount, token, note) {
        return this.duplex.send('sendSmartToken', { recipient, amount, token, note });
    },

    // Account control

    importAccount(privateKey, name, index) {
        return this.duplex.send('importAccount', { privateKey, name, index });
    },

    addAccount(mnemonic, name, index) {
        return this.duplex.send('addAccount', { mnemonic, name, index });
    },

    selectAccount(address) {
        this.duplex.send('selectAccount', address, false);
    },

    deleteAccount() {
        this.duplex.send('deleteAccount', {}, false);
    },

    getAccounts() {
        return this.duplex.send('getAccounts');
    },

    exportAccount() {
        return this.duplex.send('exportAccount');
    },

    getSelectedAccount() {
        return this.duplex.send('getSelectedAccount');
    },

    getAccountDetails(address) {
        return this.duplex.send('getAccountDetails', address);
    },

    // Node control

    selectNode(nodeID) {
        this.duplex.send('selectNode', nodeID, false);
    },

    addNode(node) {
        this.duplex.send('addNode', node, false);
    },

    deleteNode(nodeID) {
        this.duplex.send('deleteNode', nodeID, false);
    },

    getNodes() {
        return this.duplex.send('getNodes');
    },

    // Chain manage
    getChains() {
        return this.duplex.send('getChains');
    },

    selectChain(chainId) {
        this.duplex.send('selectChain', chainId, false);
    },

    getSmartToken(address) {
        return this.duplex.send('getSmartToken', address);
    },

    // Wallet authentication

    setPassword(password) {
        return this.duplex.send('setPassword', password);
    },

    unlockWallet(password) {
        return this.duplex.send('unlockWallet', password);
    },

    lockWallet() {
        return this.duplex.send('lockWallet');
    },
    // Misc

    setSelectedToken(token) {
        this.duplex.send('setSelectedToken', token, false);
    },

    getSelectedToken() {
        return this.duplex.send('getSelectedToken');
    },

    //get type of language package

    getLanguage() {
        return this.duplex.send('getLanguage');
    },

    setLanguage(language) {
        this.duplex.send('setLanguage', language, false);
    },

    getSetting() {
        return this.duplex.send('getSetting');
    },

    setSetting(setting) {
        this.duplex.send('setSetting', setting, false);
    },

    //record list
    getAccountInfo(address) {
        return this.duplex.send('getAccountInfo', address);
    },

    updateTokens(tokens) {
        this.duplex.send('updateTokens', tokens, false);
    },

    getAllTokens(selectedChain) {
        return this.duplex.send('getAllTokens',selectedChain);
    },

    setAuthorizeDapps(authorizeDapps) {
        this.duplex.send('setAuthorizeDapps', authorizeDapps, false);
    },

    getAuthorizeDapps(){
        return this.duplex.send('getAuthorizeDapps');
    },

    getAbiCode(address){
        return this.duplex.send('getAbiCode', address);
    },

    getVTokenList(){
        return this.duplex.send('getVTokenList');
    },

    depositTrx(amount){
        return this.duplex.send('depositTrx', amount);
    },

    withdrawTrx(amount){
        return this.duplex.send('withdrawTrx', amount);
    },

    depositTrc10(id, amount){
        return this.duplex.send('depositTrc10', {id,amount});
    },

    withdrawTrc10(id, amount){
        return this.duplex.send('withdrawTrc10', {id,amount});
    },

    depositTrc20(contract_address,amount){
        return this.duplex.send('depositTrc20', {contract_address,amount});
    },

    withdrawTrc20(contract_address,amount){
        return this.duplex.send('withdrawTrc20', {contract_address,amount});
    },

    updateAccountName(name) {
        return this.duplex.send('updateAccountName', {name});
    },

    getTokenById(address){
        return this.duplex.send('getTokenById', address);
    },

    authPassword(password) {
        return this.duplex.send('authPassword', password);
    },

    getTransactionDetail(hash){
        return this.duplex.send('getTransactionDetail', hash);
    },

    getWalletPassword(){
        return this.duplex.send('getWalletPassword');
    },

}

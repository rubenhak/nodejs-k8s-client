before(() => {  
    console.log(">>>>>>> BEGIN INIT")
    var ClientFetcher = require('./client');
    return ClientFetcher()
        .then(client => {
            console.log("<<<<<<< END INIT")
        });
})
import 'mocha';
import { after } from 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';
import { KubernetesClient } from '../src'

const scope : { client? : KubernetesClient } = {

}

before(() => {  
    console.log("TEST:: BEFORE BEGIN")
    return fetchClient()
        .then(client => {
            scope.client = client;
            console.log("TEST:: BEFORE READY")
        });
})

after(() => { 
    console.log("TEST:: AFTER")

    if (scope.client) {
        scope.client.close();
        delete scope.client;
    }
})
import 'mocha';
import { after } from 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';
import { KubernetesClient } from '../src'

const scope : { client? : KubernetesClient } = {

}

before(() => {  
    console.log("TEST:: BEGIN INIT")
    return fetchClient()
        .then(client => {
            scope.client = client;
            console.log("TEST:: END INIT")
        });
})

after(() => { 
    if (scope.client) {
        scope.client.close();
        delete scope.client;
    }
})
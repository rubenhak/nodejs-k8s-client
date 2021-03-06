import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';

before(() => {  
    console.log(">>>>>>> BEGIN INIT")
    return fetchClient()
        .then(client => {
            console.log("<<<<<<< END INIT")
        });
})
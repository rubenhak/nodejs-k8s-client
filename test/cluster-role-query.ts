import { logger } from './utils/logger';

import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';


describe('cluster-role-query', function() {

    it('case-1', function () {
        
        return fetchClient()
            .then(client => {
                should(client.ClusterRole).be.ok();
                return client.ClusterRole!.queryAll()
            })
            .then(result => {
                should(result).be.an.Array;

                // console.log(result.map(x => x.metadata.name));

                should(result).matchAny(x => x.metadata.name == "admin");
            });

    });
    
});
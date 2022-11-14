import { logger } from './utils/logger';

import 'mocha';
import should = require('should');
import _ from 'the-lodash';
import { fetchClient } from './utils/client';

describe('custom-priority-class-query', function() {

    it('case-1', function () {
        
        return fetchClient()
            .then(client => {
                const accessor = client.client("PriorityClass", "scheduling.k8s.io")
                should(accessor).be.ok();

                return accessor!.queryAll()
            })
            .then(result => {
                should(result).be.an.Array;

                // console.log(result.map(x => x.metadata.name));

                should(result!).matchAny(x => x.metadata.name == "system-cluster-critical");
            });

    });
    
});
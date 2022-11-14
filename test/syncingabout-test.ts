import { logger } from './utils/logger';

import 'mocha';
import should from 'should';
import _ from 'the-lodash';

import build from '../src/vendor/syncingabout';

describe('syncingabout-tests', function() {

    it('simple', function () {

        const method = build('../test/syncingabout-method.js');

        const result = method(2047);

        should(result).be.equal(2048);

    })
    .timeout(10 * 1000);

    it('two-calls', function () {

        const method = build('../test/syncingabout-method.js');

        {
            const result = method(2040);
            should(result).be.equal(2041);
        }

        {
            const result = method(3000);
            should(result).be.equal(3001);
        }

    })
    .timeout(10 * 1000);

    it('throws-exception', function () {

        const method = build('../test/syncingabout-method.js');

        let error : any = null;
        try
        {
            method(4000);
        }
        catch(reason)
        {
            error = reason;
        }

        should(error).be.ok();
        should(error.message).be.equal('4000 is not allowed');

    })
    .timeout(10 * 1000);

    it('sync-promise-rejection', function () {

        const method = build('../test/syncingabout-method.js');

        let error : any = null;
        try
        {
            method(5000);
        }
        catch(reason)
        {
            error = reason;
        }

        should(error).be.equal('5000 is not allowed');

    })
    .timeout(10 * 1000);


});
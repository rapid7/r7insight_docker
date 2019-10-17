const assert = require('assert');
const sinon = require('sinon');
const util = require('util');

const {cli, utils} = require('../index');


describe('cli function', function() {
    afterEach(function () {
        sinon.restore();
    });

    it('secure default without override', function () {
        //  Fake start function to see what gets passed in from `cli`
        const startFake = sinon.fake();
        sinon.replace(utils, 'start', startFake);

        cli(['node', 'index.js', '-t', 'give_me_rent', '-r', 'eu']);

        assert(startFake.calledOnce, util.format('Expected %s calls to start fake, got %s',
                                                 1, startFake.callCount));

        const call_args = startFake.getCall(0).lastArg;
        assert(call_args.secure, util.format('Expected secure to be %s, got %s',
                                             true, false));
    });

    it('not secure if specified', function() {
        //  Fake start function to see what gets passed in from `cli`
        const startFake = sinon.fake();
        sinon.replace(utils, 'start', startFake);

        cli(['node', 'index.js', '-t', 'what_about_my_uncle', '-r', 'eu', '--no-secure']);

        assert(startFake.calledOnce, util.format('Expected %s calls to start fake, got %s',
                                                 1, startFake.callCount));

        const call_args = startFake.getCall(0).lastArg;
        assert(!call_args.secure, util.format('Expected secure to be %s, got %s',
                                             false, true)); 
    });

    it('not secure if specified alias', function() {
        //  Fake start function to see what gets passed in from `cli`
        const startFake = sinon.fake();
        sinon.replace(utils, 'start', startFake);

        cli(['node', 'index.js', '-t', 'youre_fired', '-r', 'eu', '--no-s']);

        assert(startFake.calledOnce, util.format('Expected %s calls to start fake, got %s',
                                                 1, startFake.callCount));

        const call_args = startFake.getCall(0).lastArg;
        assert(!call_args.secure, util.format('Expected secure to be %s, got %s',
                                             false, true)); 
    });
});

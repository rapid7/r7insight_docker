const assert = require('assert');
const chai = require('chai');
const sinon = require('sinon');
const util = require('util');

const {cli, utils} = require('../index');


describe('commander argument parsing', () => {
    afterEach(function () {
		sinon.restore();
    });

    it('should have the right default parameters', () => {
        const args = utils.parse_args(['node', 'index.js', '-r', 'eu']);

        assert.deepStrictEqual(args.add, [ 'host=DUB-MBP-6617' ]);
        assert.equal(args.statsinterval, 30);
        assert.equal(args.json, false);
        assert.equal(args.secure, true);
        assert.equal(args.eventstoken, undefined);
        assert.equal(args.statstoken, undefined);
        assert.equal(args.token, undefined);
        assert.equal(args.loggerlevel, undefined);
        assert.equal(args.events, true);
        assert.equal(args.logs, true);
        assert.equal(args.stats, true);
        assert.equal(args.port, undefined);
	});

	it('should have the right default parameters if ENV variables are specified', () => {
        // Setup environment variables to check whether defaults are applied
        process.env.INSIGHT_EVENTSTOKEN  = 'muh-events'
        process.env.INSIGHT_LOGSTOKEN    = 'muh-logs'
        process.env.INSIGHT_STATSTOKEN   = 'muh-stats'
        process.env.INSIGHT_TOKEN        = 'muh-token'
		process.env.INSIGHT_LOGGER_LEVEL = 'muh-logger'

        const args = utils.parse_args(['node', 'index.js', '-r', 'eu']);

        assert.equal(args.eventstoken, 'muh-events');
        assert.equal(args.logstoken, 'muh-logs');
        assert.equal(args.statstoken, 'muh-stats');
        assert.equal(args.token, 'muh-token');
        assert.equal(args.loggerlevel, 'muh-logger');
	});
	
    it('should enforce region flag', () => {
        //  Stub process.exit to test whether we exit correctly
        sinon.stub(process, 'exit');

		utils.parse_args(['node', 'index.js']);

        assert(process.exit.calledOnce, util.format('Expected 1 calls to process.exit, got %s',
                                                    process.exit.callCount));
	});
	
    it('should read all arguments correctly when specified', () => {
		const args = utils.parse_args(['node', 'index.js',
									   '-r', 'us',
									   '-a', 'my_name=jeff',
									   '-i', '9000',
									   '-j',
									   '-e', 'events',
									   '-l', 'logs',
									   '-k', 'stats',
									   '-t', 'all',
									   '-v', 'very_critical',
									   '--matchByName', 'match_name',
									   '--matchByImage', 'match_image',
									   '--skipByName', 'skip_name',
									   '--skipByImage', 'skip_image',
									   '--no-events',
									   '--no-logs',
									   '--no-stats',
									   '--no-secure',
									   '--port', '8080',
									   '--server', 'not-a-scam.com',
									]);
		assert.equal(args.region, 'us');
		assert.equal(args.add, 'my_name=jeff');
		assert.equal(args.statsinterval, '9000');
		assert(args.json);
		assert.equal(args.eventstoken, 'events');
		assert.equal(args.logstoken, 'logs');
		assert.equal(args.statstoken, 'stats');
		assert.equal(args.token, 'all');
		assert.equal(args.loggerlevel, 'very_critical');
		assert.equal(args.matchByName, 'match_name');
		assert.equal(args.matchByImage, 'match_image');
		assert.equal(args.skipByName, 'skip_name');
		assert.equal(args.skipByImage, 'skip_image');
		assert(!args.events);
		assert(!args.stats);
		assert(!args.logs);
		assert(!args.secure);
		assert.equal(args.port, '8080');
		assert.equal(args.server, 'not-a-scam.com');
	});
});

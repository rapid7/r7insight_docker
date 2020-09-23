const assert = require('assert');
const sinon = require('sinon');
const util = require('util');

const os = require('os');

const {utils} = require('../index');


describe('commander argument parsing', () => {
    afterEach(function () {
		sinon.restore();
    });

    it('should have the right default parameters', () => {
        const args = utils.parse_args(['node', 'index.js', '-r', 'eu']);

        assert.deepStrictEqual(args.add, [ 'host=' + os.hostname() ]);
        assert.strictEqual(args.statsinterval, 30);
        assert.strictEqual(args.json, false);
        assert.strictEqual(args.secure, true);
        assert.strictEqual(args.eventstoken, undefined);
        assert.strictEqual(args.statstoken, undefined);
        assert.strictEqual(args.token, undefined);
        assert.strictEqual(args.logLevel, 'info');
        assert.strictEqual(args.dockerEvents, true);
        assert.strictEqual(args.logs, true);
        assert.strictEqual(args.stats, true);
        assert.strictEqual(args.port, undefined);
	});

	it('should have the right default parameters if ENV variables are specified', () => {
        // Setup environment variables to check whether defaults are applied
        process.env.INSIGHT_EVENTSTOKEN  = 'muh-events'
        process.env.INSIGHT_LOGSTOKEN    = 'muh-logs'
        process.env.INSIGHT_STATSTOKEN   = 'muh-stats'
        process.env.INSIGHT_TOKEN        = 'muh-token'
		process.env.INSIGHT_LOG_LEVEL = 'muh-logger'

        const args = utils.parse_args(['node', 'index.js', '-r', 'eu']);

        assert.strictEqual(args.eventstoken, 'muh-events');
        assert.strictEqual(args.logstoken, 'muh-logs');
        assert.strictEqual(args.statstoken, 'muh-stats');
        assert.strictEqual(args.token, 'muh-token');
        assert.strictEqual(args.logLevel, 'muh-logger');
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
									   '--no-docker-events',
									   '--no-logs',
									   '--no-stats',
									   '--no-secure',
									   '--port', '8080',
									   '--server', 'not-a-scam.com',
									]);
		assert.strictEqual(args.region, 'us');
		assert.strictEqual(args.add, 'my_name=jeff');
		assert.strictEqual(args.statsinterval, '9000');
		assert(args.json);
		assert.strictEqual(args.eventstoken, 'events');
		assert.strictEqual(args.logstoken, 'logs');
		assert.strictEqual(args.statstoken, 'stats');
		assert.strictEqual(args.token, 'all');
		assert.strictEqual(args.logLevel, 'very_critical');
		assert.strictEqual(args.matchByName, 'match_name');
		assert.strictEqual(args.matchByImage, 'match_image');
		assert.strictEqual(args.skipByName, 'skip_name');
		assert.strictEqual(args.skipByImage, 'skip_image');
		assert(!args.dockerEvents);
		assert(!args.stats);
		assert(!args.logs);
		assert(!args.secure);
		assert.strictEqual(args.port, '8080');
		assert.strictEqual(args.server, 'not-a-scam.com');
	});

	it('should continue supporting deprecated CLI flags', () => {
		const args = utils.parse_args(['node', 'index.js', '-r', 'us',
									   '--no-dockerEvents',
									   '--debug',
									]);
		assert(!args.dockerEvents);
		assert.strictEqual(args.logLevel, 'debug');
	});
});

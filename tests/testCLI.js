const assert = require('assert');
const chai = require('chai');
const sinon = require('sinon');

const {cli, utils} = require('../index');


describe('cli function', () => {
    afterEach(function () {
        sinon.restore();
    });

    it('should ensure log token is set if logs are enabled', () => {
        chai.expect(() => {
            cli(['node', 'index.js', '-r', 'eu'])
        }).to.throw('Logs enabled but log token not supplied or not valid UUID!');
    });

    it('should ensure stats token is set if stats are enabled', () => {
        chai.expect(() => {
            cli(['node', 'index.js', '-r', 'eu', '--logstoken', '00112233-4455-6677-8899-aabbccddeeff'])
        }).to.throw('Stats enabled but stats token not supplied or not valid UUID!');
    });

    it('should ensure events token is set if events are enabled', () => {
        chai.expect(() => {
            cli(['node', 'index.js', '-r', 'eu', '--logstoken', '00112233-4455-6677-8899-aabbccddeeff', '--statstoken', '00112233-4455-6677-8899-aabbccddeeff'])
        }).to.throw('Events enabled but events token not supplied or not valid UUID!');
    });


    it("should not crash if log token isn't set if logs are disabled", () => {
        chai.expect(() => {
            cli(['node', 'index.js', '-r', 'eu', '--no-logs'])
        }).to.not.throw('Logs enabled but log token not supplied or not valid UUID!');
    });

    it("should not crash if stats token isn't set if stats are disabled", () => {
        chai.expect(() => {
            cli(['node', 'index.js', '-r', 'eu', '--no-logs', '--no-stats'])
        }).to.not.throw('Stats enabled but no stats token!');
    });

    it("should not crash events token isn't set if events are disabled", () => {
        chai.expect(() => {
            cli(['node', 'index.js', '-r', 'eu', '--no-logs', '--no-stats', '--no-docker-events'])
        }).to.not.throw('Events enabled but no events token!');
    });


    it("should crash if no logs, stats or events are forwarded", () => {
        chai.expect(() => {
            cli(['node', 'index.js',
                       '-r', 'eu',
                       '--no-logs',
                       '--no-stats',
                       '--no-docker-events',
            ])
        }).to.throw('You need to enable either logs, stats or events.');
    });

    it('should set port accordingly to secure', () => {
        //  Fake start function to see what gets passed in from `cli`
        const startFake = sinon.fake();
        sinon.replace(utils, 'start', startFake);

        cli(['node', 'index.js', '-r', 'eu', '-t', '00112233-4455-6677-8899-aabbccddeeff']);
        assert.strictEqual(startFake.getCall(0).lastArg.port, 443);

        cli(['node', 'index.js', '-r', 'eu', '-t', '00112233-4455-6677-8899-aabbccddeeff', '--no-secure']);
        assert.strictEqual(startFake.getCall(1).lastArg.port, 80);
    });

    it('should parse port correctly if set', () => {
        //  Fake start function to see what gets passed in from `cli`
        const startFake = sinon.fake();
        sinon.replace(utils, 'start', startFake);

        cli(['node', 'index.js', '-r', 'eu', '-t', '00112233-4455-6677-8899-aabbccddeeff', '--port', '123']);
        assert.strictEqual(startFake.getCall(0).lastArg.port, 123);

        chai.expect(() => {
            cli(['node', 'index.js', '-r', 'eu', '-t', '00112233-4455-6677-8899-aabbccddeeff', '--port', 'asd']);
        }).to.throw(`Port must be a number`);
    });
});

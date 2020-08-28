const assert = require('assert');
const chai = require('chai');
const sinon = require('sinon');
const util = require('util');

const {cli, utils} = require('../index');


describe('cli function', () => {
    afterEach(function () {
        sinon.restore();
    });

    it('should ensure log token is set if logs are enabled', () => {
        chai.expect(() => {
            cli(['node', 'index.js', '-r', 'eu'])
        }).to.throw('Logs enabled but no log token!');
    });

    it('should ensure stats token is set if stats are enabled', () => {
        chai.expect(() => {
            cli(['node', 'index.js', '-r', 'eu', '--logstoken', 'asd'])
        }).to.throw('Stats enabled but no stats token!');
    });

    it('should ensure events token is set if events are enabled', () => {
        chai.expect(() => {
            cli(['node', 'index.js', '-r', 'eu', '--logstoken', 'asd', '--statstoken', 'das good'])
        }).to.throw('Events enabled but no events token!');
    });


    it("should not crash if log token isn't set if logs are disabled", () => {
        chai.expect(() => {
            cli(['node', 'index.js', '-r', 'eu', '--no-logs'])
        }).to.not.throw('Logs enabled but no log token!');
    });

    it("should not crash if stats token isn't set if stats are disabled", () => {
        chai.expect(() => {
            cli(['node', 'index.js', '-r', 'eu', '--no-logs', '--no-stats'])
        }).to.not.throw('Stats enabled but no stats token!');
    });

    it("should not crash events token isn't set if events are disabled", () => {
        chai.expect(() => {
            cli(['node', 'index.js', '-r', 'eu', '--no-logs', '--no-stats', '--no-events'])
        }).to.not.throw('Events enabled but no events token!');
    });


    it("should crash if no logs, stats or events are forwarded", () => {
        chai.expect(() => {
            cli(['node', 'index.js',
                       '-r', 'eu',
                       '--no-logs',
                       '--no-stats',
                       '--no-events',
            ])
        }).to.throw('You need to enable either logs, stats or events.');
    });

    it('should set port accordingly to secure', () => {
        //  Fake start function to see what gets passed in from `cli`
        const startFake = sinon.fake();
        sinon.replace(utils, 'start', startFake);

        cli(['node', 'index.js', '-r', 'eu', '-t', 'asd']);
        assert.equal(startFake.getCall(0).lastArg.port, 443);

        cli(['node', 'index.js', '-r', 'eu', '-t', 'asd', '--no-secure']);
        assert.equal(startFake.getCall(1).lastArg.port, 80);
    });

    it('should parse port correctly if set', () => {
        //  Fake start function to see what gets passed in from `cli`
        const startFake = sinon.fake();
        sinon.replace(utils, 'start', startFake);

        cli(['node', 'index.js', '-r', 'eu', '-t', 'asd', '--port', '123']);
        assert.equal(startFake.getCall(0).lastArg.port, 123);

        chai.expect(() => {
            cli(['node', 'index.js', '-r', 'eu', '-t', 'asd', '--port', 'asd']);
        }).to.throw(`Port must be a number`);
    });
});

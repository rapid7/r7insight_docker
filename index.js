#! /usr/bin/env node

'use strict';

const tls = require('tls');
const net = require('net');
const eos = require('end-of-stream');
const through = require('through2');
const minimist = require('minimist');
const allContainers = require('docker-allcontainers');
const statsFactory = require('docker-stats');
const logFactory = require('docker-loghose');
const eventsFactory = require('docker-event-log');
const os = require('os');

let debugLogging = !!process.env.INSIGHT_DOCKER_DEBUG;

const logDebug = (...args) => {
  if (!debugLogging) {
    return;
  }

  console.log(...args);
};

function connect(opts) {
  let stream;
  const endpoint = `${opts.region}${opts.server}`;
  if (opts.secure) {
    logDebug(`Establishing secure connection to ${endpoint}:${opts.port}...`);
    stream = tls.connect(opts.port, endpoint, onSecure);
  } else {
    logDebug(`Establishing plain-text connection to ${endpoint}:${opts.port}...`);
    stream = net.createConnection(opts.port, endpoint);
  }

  function onSecure() {
    // let's just crash if we are not secure
    if (!stream.authorized) {
      logDebug('Connection is not secure!');
      throw new Error('secure connection not authorized');
    }
  }

  return stream;
}


function start(opts) {
  debugLogging = opts.debug;
  const logsToken = opts.logstoken || opts.token;
  const statsToken = opts.statstoken || opts.token;
  const eventsToken = opts.eventstoken || opts.token;
  let out;
  let noRestart = () => void 0;

  const filter = through.obj(function (obj, enc, cb) {
    logDebug(`Got an event with encoding "${enc}":`, obj);

    obj = addAll(opts.add, obj);
    const token = (() => {
      const {
        line,
        type,
        stats
      } = obj;

      if (line) {
        logDebug('Using logs token:', logsToken);
        return logsToken;
      } else if (type) {
        logDebug('Using events token:', eventsToken);
        return eventsToken;
      } else if (stats) {
        logDebug('Using stats token:', statsToken);
        return statsToken;
      }

      throw new Error('Configuration did not result in a log token being set.');
    })();

    if (token) {
      logDebug('Prepending log token:', token);

      this.push(token);
      this.push(' ');
      this.push(JSON.stringify(obj));
      this.push('\n');
    }

    logDebug('Finished processing event:', obj);
    cb();
  });

  const events = allContainers(opts);
  let streamsOpened = 0;
  opts.events = events;

  const createLogHose = (condition, factory) => {
    logDebug('Creating log stream with factory:', factory);
    if (!condition()) {
      logDebug('Condition for log stream creation not met:', String(condition));
      return;
    }

    const hose = factory(opts);
    hose.pipe(filter);
    streamsOpened++;

    logDebug('Log stream created');

    return hose;
  };

  const loghose = createLogHose(() => opts.logs !== false && logsToken, logFactory);
  const stats = createLogHose(() => opts.stats !== false && statsToken, statsFactory);
  const dockerEvents = createLogHose(() => opts.dockerEvents !== false && eventsToken, eventsFactory);

  if (!stats && !loghose && !dockerEvents) {
    throw new Error(`You should enable either stats, logs or dockerEvents, \
this might be due to missing log token.`);
  }

  pipe();

  // destroy out if all streams are destroyed
  loghose && eos(loghose, () => {
    logDebug('Closing log stream');
    streamsOpened--;
    streamClosed(streamsOpened);
  });
  stats && eos(stats, () => {
    logDebug('Closing stats log stream');
    streamsOpened--;
    streamClosed(streamsOpened);
  });
  dockerEvents && eos(dockerEvents, () => {
    logDebug('Closing Docker events log stream');
    streamsOpened--;
    streamClosed(streamsOpened);
  });

  return loghose;

  function addAll(proto, obj) {
    if (!proto) {
      return;
    }

    const newObj = {...obj};

    for (const key in proto) {
      if (proto.hasOwnProperty(key)) {
        logDebug(`Adding key "${key}" with value "${proto[key]}"`);
        newObj[key] = proto[key];
      }
    }

    return newObj;
  }

  function pipe() {
    logDebug('Starting data pipe...');

    if (out) {
      filter.unpipe(out);
    }

    out = connect(opts);

    filter.pipe(out, { end: false });

    // automatically reconnect on socket failure
    noRestart = eos(out, pipe);
  }

  function streamClosed(streamsOpened) {
    if (streamsOpened <= 0) {
      noRestart();
      out.destroy();
    }
  }
}

function cli(process_args) {
  const argv = minimist(process_args.slice(2), {
    boolean: ['json', 'secure', 'stats', 'logs', 'dockerEvents', 'debug'],
    string: ['token', 'region', 'logstoken', 'statstoken', 'eventstoken', 'server', 'port'],
    alias: {
      'token': 't',
      'region': 'r',
      'logstoken': 'l',
      'newline': 'n',
      'statstoken': 'k',
      'eventstoken': 'e',
      'secure': 's',
      'json': 'j',
      'statsinterval': 'i',
      'add': 'a',
      'debug': 'd'
    },
    default: {
      json: false,
      secure: true,
      newline: true,
      stats: true,
      logs: true,
      dockerEvents: true,
      statsinterval: 30,
      add: [ 'host=' + os.hostname() ],
      debug: !!process.env.INSIGHT_DOCKER_DEBUG,
      token: process.env.INSIGHT_TOKEN,
      logstoken: process.env.INSIGHT_LOGSTOKEN || process.env.INSIGHT_TOKEN,
      statstoken: process.env.INSIGHT_STATSTOKEN || process.env.INSIGHT_TOKEN,
      eventstoken: process.env.INSIGHT_EVENTSTOKEN || process.env.INSIGHT_TOKEN,
      server: '.data.logs.insight.rapid7.com',
      port: undefined
    }
  });

  if (argv.help || !(argv.token || argv.logstoken || argv.statstoken || argv.eventstoken) || !(argv.region)) {
    console.log('Usage: r7insight_docker [-l LOGSTOKEN] [-k STATSTOKEN] [-e EVENTSTOKEN]\n' +
                '                         [-t TOKEN] [--no-secure] [--json]\n' +
                '                         [-r REGION]\n' +
                '                         [--no-newline] [--no-stats] [--no-logs] [--no-dockerEvents]\n' +
                '                         [-i STATSINTERVAL] [-a KEY=VALUE]\n' +
                '                         [--matchByImage REGEX] [--matchByName REGEX]\n' +
                '                         [--skipByImage REGEX] [--skipByName REGEX]\n' +
                '                         [--server HOSTNAME] [--port PORT]\n' +
                '                         [--debug]\n' +
                '                         [--help]');

    process.exit(1);
  }

  const getPort = () => {
    if (argv.port == undefined) {
      if (argv.secure) {
        return 443;
      }

      return 80;
    }

    // TODO: support service names

    return parseInt(argv.port);
  };
  argv.port = getPort();
  if (isNaN(argv.port)) {
    console.log('port must be a number');
    process.exit(1);
  }

  if (argv.add && !Array.isArray(argv.add)) {
    argv.add = [argv.add];
  }
  argv.add = argv.add.reduce((acc, arg) => {
    arg = arg.split('=');
    acc[arg[0]] = arg[1];
    return acc
  }, {});

  utils.start(argv);
}

const utils = {
  start,
};

module.exports = {
  cli,
  utils,
};

if (require.main === module) {
  cli(process.argv);
}

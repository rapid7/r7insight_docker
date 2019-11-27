#! /usr/bin/env node

'use strict';

var tls = require('tls');
var net = require('net');
var eos = require('end-of-stream');
var through = require('through2');
var minimist = require('minimist');
var allContainers = require('docker-allcontainers');
var statsFactory = require('docker-stats');
var logFactory = require('docker-loghose');
var eventsFactory = require('docker-event-log');
var os = require('os');

function connect(opts) {
  var stream;
  if (opts.secure) {
    stream = tls.connect(opts.port, opts.region + opts.server, onSecure);
  } else {
    stream = net.createConnection(opts.port, opts.region + opts.server);
  }

  function onSecure() {
    // let's just crash if we are not secure
    if (!stream.authorized) throw new Error('secure connection not authorized');
  }

  return stream;
}


function start(opts) {

  var logsToken = opts.logstoken || opts.token;
  var statsToken = opts.statstoken || opts.token;
  var eventsToken = opts.eventstoken || opts.token;
  var out;
  var noRestart = function() {};

  var filter = through.obj(function(obj, enc, cb) {
    addAll(opts.add, obj);
    var token = '';

    if (obj.line) {
      token = logsToken;
    }
    else if (obj.type) {
      token = eventsToken;
    }
    else if (obj.stats) {
      token = statsToken;
    }

    if (token) {
      this.push(token);
      this.push(' ');
      this.push(JSON.stringify(obj));
      this.push('\n');
    }

    cb()
  });

  var events = allContainers(opts);
  var loghose;
  var stats;
  var dockerEvents;
  var streamsOpened = 0;

  opts.events = events;

  if (opts.logs !== false && logsToken) {
    loghose = logFactory(opts);
    loghose.pipe(filter);
    streamsOpened++;
  }

  if (opts.stats !== false && statsToken) {
    stats = statsFactory(opts);
    stats.pipe(filter);
    streamsOpened++;
  }

  if (opts.dockerEvents !== false && eventsToken) {
    dockerEvents = eventsFactory(opts);
    dockerEvents.pipe(filter);
    streamsOpened++;
  }

  if (!stats && !loghose && !dockerEvents) {
    throw new Error(`You should enable either stats, logs or dockerEvents, \
this might be due to missing log token.`);
  }

  pipe();

  // destroy out if all streams are destroyed
  loghose && eos(loghose, function() {
    streamsOpened--;
    streamClosed(streamsOpened);
  });
  stats && eos(stats, function() {
    streamsOpened--;
    streamClosed(streamsOpened);
  });
  dockerEvents && eos(dockerEvents, function() {
    streamsOpened--;
    streamClosed(streamsOpened);
  });

  return loghose;

  function addAll(proto, obj) {
    if (!proto) { return; }

    var key;
    for (key in proto) {
      if (proto.hasOwnProperty(key)) {
        obj[key] = proto[key];
      }
    }
  }

  function pipe() {
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
      noRestart()
      out.destroy();
    }
  }
}

var unbound;

function cli(process_args) {
  var argv = minimist(process_args.slice(2), {
    boolean: ['json', 'secure', 'stats', 'logs', 'dockerEvents'],
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
      'add': 'a'
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
      token: process.env.INSIGHT_TOKEN,
      logstoken: process.env.INSIGHT_LOGSTOKEN || process.env.INSIGHT_TOKEN,
      statstoken: process.env.INSIGHT_STATSTOKEN || process.env.INSIGHT_TOKEN,
      eventstoken: process.env.INSIGHT_EVENTSTOKEN || process.env.INSIGHT_TOKEN,
      server: '.data.logs.insight.rapid7.com',
      port: unbound
    }
  });



  if (argv.help || !(argv.token || argv.logstoken || argv.statstoken || argv.eventstoken) || !(argv.region)) {
    console.log('Usage: r7insight_docker [-l LOGSTOKEN] [-k STATSTOKEN] [-e EVENTSTOKEN]\n' +
                '                         [-t TOKEN] [--no-secure] [--json]\n' +
                '                         [-r REGION]\n' +
                '                         [--no-newline] [--no-stats] [--no-logs] [--no-dockerEvents]\n' +
                '                         [-i STATSINTERVAL] [-a KEY=VALUE]\n' +
                '                         [--matchByImage REGEXP] [--matchByName REGEXP]\n' +
                '                         [--skipByImage REGEXP] [--skipByName REGEXP]\n' +
                '                         [--server HOSTNAME] [--port PORT]\n' +
                '                         [--help]');

    process.exit(1);
  }

  if (argv.port == unbound) {
    if (argv.secure) {
      argv.port = 443;
    } else {
      argv.port = 80;
    }
  } else {
      argv.port = parseInt(argv.port);
      // TODO: support service names
      if (isNaN(argv.port)) {
        console.log('port must be a number');
        process.exit(1);
      }
  }

  if (argv.add && !Array.isArray(argv.add)) {
    argv.add = [argv.add];
  }

  argv.add = argv.add.reduce(function(acc, arg) {
    arg = arg.split('=');
    acc[arg[0]] = arg[1];
    return acc
  }, {});

  utils.start(argv);
}

var utils = {
  start: start,
}
module.exports = {
  cli: cli,
  utils: utils,
}

if (require.main === module) {
  cli(process.argv);
}

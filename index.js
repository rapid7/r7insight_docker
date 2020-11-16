#! /usr/bin/env node

'use strict';

const allContainers = require('docker-allcontainers');
const dns = require('dns');
const eos = require('end-of-stream');
const eventsFactory = require('docker-event-log');
const logFactory = require('docker-loghose');
const net = require('net');
const os = require('os');
const statsFactory = require('docker-stats');
const through = require('through2');
const tls = require('tls');
const winston = require('winston');

const { Command } = require('commander');


const UUID_REGEX = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/;

//  Winston logger initialised after CLI arg parsing
let LOGGER;


function connect(opts) {
  let stream;

  const endpoint = `${opts.region}${opts.server}`;

  dns.lookup(endpoint, (err, address, family) => {
    if (!err) {
      LOGGER.debug(`Successfully resolved DNS. address: "${address}" family: "${family}"`)
    } else {
      LOGGER.error(`Failed to resolve DNS. error: ${err}`);
    }
  });

  if (opts.secure) {
    LOGGER.info(`Establishing secure connection to "${endpoint}:${opts.port}"`);
    stream = tls.connect(opts.port, endpoint, onSecure);
  } else {
    LOGGER.info(`Establishing plain-text connection to "${endpoint}:${opts.port}"`);
    stream = net.createConnection(opts.port, endpoint);
  }

  function onSecure() {
    if (!stream.authorized) {
      // let's just crash if we are not secure
      throw new Error('Secure connection is not authorized');
    }
    LOGGER.debug('Secure connection established');
  }

  return stream;
}


function start(opts) {
  let out;
  let noRestart = () => void 0;

  const filter = through.obj(function (obj, enc, cb) {
    LOGGER.debug(`Got an event with encoding "${enc}":`, obj);

    LOGGER.debug('Enriching log with --add contents')
    obj = addAll(opts.add, obj);

    function addAll(proto, obj) {
      let ret = {
        ...(obj || {}),
        ...(proto|| {}),
      }
      LOGGER.debug('Returning enriched log:', ret);
      return ret;
    }

    LOGGER.debug('Getting correct token for obj...')
    const token = (() => {
      if (obj.line) {
        LOGGER.debug(`Using logs token: ${opts.logstoken}`);
        return opts.logstoken;
      } else if (obj.type) {
        LOGGER.debug(`Using events token: ${opts.eventstoken}`);
        return opts.eventstoken;
      } else if (obj.stats) {
        LOGGER.debug(`Using stats token: ${opts.statstoken}`);
        return opts.statstoken;
      } else {
        LOGGER.error('Unable to figure out correct token to use, skipping log...');
      }
    })();

    if (token) {
      LOGGER.debug(`Stringifying object and prepending log token: ${token}`);

      this.push(token);
      this.push(' ');
      this.push(JSON.stringify(obj));
      this.push('\n');
    }

    LOGGER.debug('Finished processing log message, calling callback...');
    cb();
  });

  LOGGER.debug('Getting all containers events...')
  const events = allContainers(opts);
  let streamsOpened = 0;
  opts.events = events;

  const createLogHose = (condition, factory) => {
    if (!condition()) {
      LOGGER.debug(`Condition for log stream creation not met: ${condition}`);
      return;
    }

    LOGGER.debug('Creating hose')
    const hose = factory(opts);
    LOGGER.debug('Calling pipe')
    hose.pipe(filter);
    streamsOpened++;

    LOGGER.debug('Log stream created');
    return hose;
  };

  LOGGER.debug('Creating log hose');
  const loghose = createLogHose(() => opts.logs !== false, logFactory);
  LOGGER.debug('Creating statistics hose');
  const statshose = createLogHose(() => opts.stats !== false, statsFactory);
  LOGGER.debug('Creating events hose');
  const eventshose = createLogHose(() => opts.dockerEvents !== false, eventsFactory);

  pipe();
  function pipe() {
    LOGGER.debug('Starting data pipe...');

    if (out) {
      LOGGER.debug('Unpiping filter...');
      filter.unpipe(out);
    }

    LOGGER.debug('Connecting to ingestion');
    out = connect(opts);

    LOGGER.debug('Calling filter pipe...')
    filter.pipe(out, { end: false });

    LOGGER.debug('Setting noRestart')
    // automatically reconnect on socket failure
    noRestart = eos(out, pipe);
  }

  // destroy out if all streams are destroyed
  loghose && eos(loghose, () => {
    LOGGER.debug('Closing log stream');
    streamsOpened--;
    streamClosed(streamsOpened);
  });
  statshose && eos(statshose, () => {
    LOGGER.debug('Closing stats log stream');
    streamsOpened--;
    streamClosed(streamsOpened);
  });
  eventshose && eos(eventshose, () => {
    LOGGER.debug('Closing Docker events log stream');
    streamsOpened--;
    streamClosed(streamsOpened);
  });

  function streamClosed(streamsOpened) {
    LOGGER.debug(`Stream closed. ${streamsOpened} streams remain opened.`);
    if (streamsOpened <= 0) {
      noRestart();
      out.destroy();
    }
  }

  return loghose;
}

function parse_args(process_args) {
  const program = new Command();
  program
    //  Required since region is a property on Commander Command
    //  https://github.com/tj/commander.js#avoiding-option-name-clashes
    .storeOptionsAsProperties(false)
    .name('r7insight_docker')
    .version(process.env.npm_package_version)
    .requiredOption('-r, --region <REGION>', 'The region to forward your logs to')
    .option('-a, --add <NAME>=<VALUE>', 'Add KVPs to the data being published', [ 'host=' + os.hostname() ])
    .option('-i, --statsinterval <STATS_INTERVAL>', 'Downsample stats send to Insight Platform', 30)
    .option('-j, --json', 'Stream logs in JSON format', false)
    .option('-e, --eventstoken <EVENTS_TOKEN>', 'Specify log token for forwarding events', process.env.INSIGHT_EVENTSTOKEN)
    .option('-l, --logstoken <LOGS_TOKEN>', 'Specify log token for logs', process.env.INSIGHT_LOGSTOKEN)
    .option('-k, --statstoken <STATS_TOKEN>', 'Specify log token for forwarding statistics', process.env.INSIGHT_STATSTOKEN)
    .option('-t, --token <TOKEN>', 'Specify token to use', process.env.INSIGHT_TOKEN)
    .option('-v, --log-level <LEVEL>', 'Define application log level', process.env.INSIGHT_LOG_LEVEL || 'info')
    //  TODO (sbialkowski): Remove in next release
    .option('--debug', 'DEPRECATED: Set application log level to "debug" (use `--log-level debug`)', false)
    .option('--matchByName <REGEX>', 'Forward logs for containers whose name matches <REGEX>')
    .option('--matchByImage <REGEX>', 'Forward logs for containers whose image matches <REGEX>')
    .option('--skipByName <REGEX>', 'Do not forward logs for containers whose name matches <REGEX>')
    .option('--skipByImage <REGEX>', 'Do not forward logs for containers whose image matches <REGEX>')
    .option('--no-docker-events, --no-dockerEvents', 'Do not stream Docker events')
    .option('--no-logs', 'Do not stream logs')
    .option('--no-stats', 'Do not stream statistics')
    .option('--no-secure', 'Send logs un-encrypted; no TSL/SSL')
    .option('--port <PORT>', 'Specify port to forward logs to. Default depends on whether secure is set', undefined)
    .option('--server <SERVER>', 'Specify server to forward logs to', '.data.logs.insight.rapid7.com')
    .parse(process_args);

  //  TODO (sbialkowski): Remove in next release
  let options = program.opts();
  if (options.debug) {
    options.logLevel = 'debug';
  }

  return options;
}

function cli(process_args) {
  let args = parse_args(process_args);

  LOGGER = winston.createLogger({
    level: args.logLevel,
    format: winston.format.combine(
       winston.format.simple(),
       winston.format.splat(),
    ),
    transports: [
      new winston.transports.Console(),
    ],
  })
 
  LOGGER.info('Starting...');

  //  TODO (sbialkowski): Remove in next release
  if (process_args.includes('--no-dockerEvents')) {
    LOGGER.warn(`'--no-dockerEvents' flag has been renamed to '--no-docker-events' \
and may be removed in a next release. Please update your usage.`);
  }
  if (args.debug) {
    LOGGER.warn(`'--debug' flag has been deprecated in favour of '--log-level debug' \
and may be removed in a next release. Please update your usage.`);
  }

  LOGGER.debug('Initial configuration:', args);

  if (!(args.logs || args.stats || args.dockerEvents)) {
    throw new Error('You need to enable either logs, stats or events.');
  }

  if (args.token) {
    args.logstoken = args.logstoken || args.token;
    args.statstoken = args.statstoken || args.token;
    args.eventstoken = args.eventstoken || args.token;
  }

  if (args.logs && !UUID_REGEX.test(args.logstoken)) {
    throw new Error('Logs enabled but log token not supplied or not valid UUID!');
  } else if (args.stats && !UUID_REGEX.test(args.statstoken)) {
    throw new Error('Stats enabled but stats token not supplied or not valid UUID!');
  } else if (args.dockerEvents && !UUID_REGEX.test(args.eventstoken)) {
    throw new Error('Events enabled but events token not supplied or not valid UUID!');
  }

  const getPort = () => {
    if (args.port == undefined) {
      if (args.secure) {
        return 443;
      }
      return 80;
    }

    // TODO: support service names

    return parseInt(args.port);
  };

  args.port = getPort();
  LOGGER.info(`Using port ${args.port}`);

  if (isNaN(args.port)) {
    throw new Error(`Port must be a number`);
  }

  LOGGER.info('Processing --add flag');
  if (args.add && !Array.isArray(args.add)) {
    args.add = [args.add];
  }
  args.add = args.add.reduce((acc, arg) => {
    arg = arg.split('=');
    acc[arg[0]] = arg[1];
    return acc
  }, {});
  LOGGER.debug('Add after processing:', args.add);

  utils.start(args);
}

const utils = {
  start,
  parse_args,
};

module.exports = {
  cli,
  utils,
};

if (require.main === module) {
  cli(process.argv);
}

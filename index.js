#! /usr/bin/env node

'use strict';

const allContainers = require('docker-allcontainers');
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


//  Winston logger initialised after CLI arg parsing
var LOGGER;


function connect(opts) {
  let stream;
  const endpoint = `${opts.region}${opts.server}`;

  if (opts.secure) {
    LOGGER.info(`Establishing secure connection to ${endpoint}:${opts.port}`);
    stream = tls.connect(opts.port, endpoint, onSecure);
  } else {
    LOGGER.info(`Establishing plain-text connection to ${endpoint}:${opts.port}`);
    stream = net.createConnection(opts.port, endpoint);
  }

  function onSecure() {
    if (!stream.authorized) {
      // let's just crash if we are not secure
      throw new Error('Secure connection is not authorized');
    }
    LOGGER.info('Connection is secure');
  }

  return stream;
}


function start(opts) {
  let out;
  let noRestart = () => void 0;

  const filter = through.obj(function (obj, enc, cb) {
    LOGGER.debug(`Got an event with encoding "${enc}"`, obj);

    LOGGER.debug('Enriching obj with --add')
    obj = addAll(opts.add, obj);
    function addAll(proto, obj) {
      LOGGER.debug('Checking proto', proto);
      if (!proto) {
        return;
      }
  
      const newObj = {...obj};
  
      for (const key in proto) {
        if (proto.hasOwnProperty(key)) {
          LOGGER.debug(`Adding key "${key}" value "${proto[key]}"`);
          newObj[key] = proto[key];
        }
      }
  
      return newObj;
    }

    LOGGER.debug('Getting correct token for obj...')
    const token = (() => {
      if (obj.line) {
        LOGGER.debug('Using logs token:', opts.logstoken);
        return opts.logstoken;
      } else if (obj.type) {
        LOGGER.debug('Using events token:', opts.eventstoken);
        return opts.eventstoken;
      } else if (obj.stats) {
        LOGGER.debug('Using stats token:', opts.statstoken);
        return opts.statstoken;
      } else {
        LOGGER.debug('Unable to figure out correct token to use, skipping log', obj);
      }
    })();

    if (token) {
      LOGGER.debug('Stringifying object and prepending log token:', token);

      this.push(token);
      this.push(' ');
      this.push(JSON.stringify(obj));
      this.push('\n');
    }

    LOGGER.debug('Finished processing event, calling callback');
    cb();
  });

  LOGGER.debug('Getting all containers events...')
  const events = allContainers(opts);
  let streamsOpened = 0;
  opts.events = events;

  LOGGER.debug('Creating log hose');
  const createLogHose = (condition, factory) => {
    if (!condition()) {
      LOGGER.debug('Condition for log stream creation not met: ', condition);
      return;
    }

    LOGGER.debug('Creating hose')
    const hose = factory(opts);
    LOGGER.debug('Creating pipe')
    hose.pipe(filter);
    streamsOpened++;

    LOGGER.debug('Log stream created');
    return hose;
  };

  LOGGER.debug('Creating logFactory');
  const loghose = createLogHose(() => opts.logs !== false, logFactory);
  LOGGER.debug('Creating statsFactory');
  const statshose = createLogHose(() => opts.stats !== false, statsFactory);
  LOGGER.debug('Creating eventsFactory');
  const eventshose = createLogHose(() => opts.events !== false, eventsFactory);

  LOGGER.debug('Creating pipe')
  pipe();
  function pipe() {
    LOGGER.debug('Starting data pipe...');

    if (out) {
       LOGGER.debug('Unpiping filter...');
      filter.unpipe(out);
    }

    LOGGER.debug('Connecting to ingestion');
    out = connect(opts);

    LOGGER.debug('Creating pipe...')
    filter.pipe(out, { end: false });

    LOGGER.debug('Setting noRestart')
    // automatically reconnect on socket failure
    noRestart = eos(out, pipe);
    LOGGER.debug('Set noRestart')
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
    LOGGER.debug('streamClosed')
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
    .option('-v, --loggerlevel <LEVEL>', 'Define application logger level', process.env.INSIGHT_LOGGER_LEVEL)
    .option('--matchByName <REGEX>', 'Forward logs for containers whose name matches <REGEX>')
    .option('--matchByImage <REGEX>', 'Forward logs for containers whose image matches <REGEX>')
    .option('--skipByName <REGEX>', 'Do not forward logs for containers whose name matches <REGEX>')
    .option('--skipByImage <REGEX>', 'Do not forward logs for containers whose image matches <REGEX>')
    .option('--no-events', 'Do not stream Docker events')
    .option('--no-logs', 'Do not stream logs')
    .option('--no-stats', 'Do not stream statistics')
    .option('--no-secure', 'Send logs un-encrypted; no TSL/SSL')
    .option('--port <PORT>', 'Specify port to forward logs to. Default depends on whether secure is set', undefined)
    .option('--server <SERVER>', 'Specify server to forward logs to', '.data.logs.insight.rapid7.com')
    .parse(process_args);

  return program.opts();
}

function cli(process_args) {
  let args = parse_args(process_args);

  LOGGER = winston.createLogger({
    //  If logger level isn't specified, we are silent
    silent: !args.loggerlevel,
    level: args.loggerlevel,
    format: winston.format.combine(
       winston.format.simple(),
       winston.format.splat(),
    ),
    transports: [
      new winston.transports.Console(),
    ],
  })
 
  LOGGER.info('Starting...');

  LOGGER.debug(`Initial configuration. region="${args.region}" \
add="${args.add}" \
statsinterval="${args.statsinterval}" \
json="${args.json}" \
loggerlevel="${args.loggerlevel}" \
events="${args.events}" \
logs="${args.logs}" \
secure="${args.secure}" \
stats="${args.stats}" \
port="${args.port}" \
server="${args.server}"`)

  if (!(args.logs || args.stats || args.events)) {
    throw new Error('You need to enable either logs, stats or events.');
  }

  if (args.token) {
    args.logstoken = args.logstoken || args.token;
    args.statstoken = args.statstoken || args.token;
    args.eventstoken = args.eventstoken || args.token;
  }

  if (args.logs && !args.logstoken) {
    throw new Error('Logs enabled but no log token!');
  } else if (args.stats && !args.statstoken) {
    throw new Error('Stats enabled but no stats token!');
  } else if (args.events && !args.eventstoken) {
    throw new Error('Events enabled but no events token!');
  }

  const getPort = () => {
    if (args.port == undefined) {
      if (args.secure) {
        return 443;
      }
      return 80;
    }

    // TODO (@rjacobs-r7): support service names

    return parseInt(args.port);
  };

  args.port = getPort();
  LOGGER.info(`Using port ${args.port}`);

  if (isNaN(args.port)) {
    throw new Error(`Port must be a number`);
  }

  LOGGER.info('Processing --add flag into valid array');
  if (args.add && !Array.isArray(args.add)) {
    args.add = [args.add];
  }
  args.add = args.add.reduce((acc, arg) => {
    arg = arg.split('=');
    acc[arg[0]] = arg[1];
    return acc
  }, {});

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

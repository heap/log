import * as os from 'os';
import * as path from 'path';

import * as winston from 'winston';
import fclone from 'fclone';

import { MetadataRewriter } from 'winston';
import { argv } from 'yargs';
import { FLUENT_HOST, FLUENT_PORT, FLUENT_TIMEOUT } from './constants';

const fluentLogger = require('fluent-logger')

require('winston-log-and-exit');

const isProd = process.env.NODE_ENV === 'prod';
const isECS = process.env.HEAP_ECS === 'true';

type HeapArgV = {
  pm2path: string;
};

/*
TODO: This should be configured by an external file.
It shouldn't require a code change to set logging prefs.
*/
(winston as any).exitOnError = false;

// process.mainModule is undefined when node reads from STDIN.
let mainFilename = process.mainModule === null
    ? 'unknown'
    : path.basename(process.mainModule.filename);

// :KLUDGE: Add special handling for our pm2 loading setup.
if (mainFilename === 'pm2_loader.js') {
  try {
    mainFilename = path.basename((argv as any as HeapArgV).pm2path)
  }
  catch (e) {
    // An error was encountered, likely because pm2path wasn't passed
    // in. In this case we'll just use pm2_loader for the mainfilename.
  }
}

const hostname = os.hostname();

const rewriters: Array<MetadataRewriter> = [
  (label, msg, meta) => {
    meta = fclone(meta); // Remove circular references.
    meta.mainFilename = mainFilename;
    meta.hostname = hostname;
    return meta;
  }
]

if (isECS) {
  rewriters.push((label, msg, meta) => {
    // First, check if the meta object is actually an error. In this case we want to preserve
    // the error message (which would otherwise be clobbered by the log message). Winston populates
    // the `name` field of the meta object with the class of the object if available, so just check
    // for `name === 'Error'` here.
    if (meta.name === 'Error') {
      meta.error_message = meta.message
      delete meta.message;
      delete meta.name; // This field just looks confusing.
      return meta;
    }

    // Otherwise, we expect the meta object to be tags for the log line. Apply some rudimentary
    // sanitizing here to stringify unexpected nested objects. All of our tags should be either
    // string or number values.
    for (const key of Object.keys(meta)) {
      const value = meta[key];
      const isString = typeof value === 'string';
      const isNumber = typeof value === 'number';
      if (!isString && !isNumber) {
        meta[key] = '' + JSON.stringify(value);
      }
    }

    return meta;
  })
}

const logger = new winston.Logger();
logger.rewriters = rewriters;
logger.add(winston.transports.Console, {
  json: isECS,
  stringify: (obj) => JSON.stringify(obj),
  colorize: !isECS,
  timestamp: isProd,
  level: process.env.LOG_LEVEL || 'info'
});

if (isProd && !isECS) {
  const fluentConfig = {
    host: FLUENT_HOST,
    port: FLUENT_PORT,
    timeout: FLUENT_TIMEOUT,
  };
  const fluentTransport = fluentLogger.support.winstonTransport();
  const transport = new fluentTransport('heap.coffee', fluentConfig);
  logger.add(transport, null, true);
}

module.exports = logger;

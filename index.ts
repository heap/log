import * as os from 'os';
import * as path from 'path';

import { format, createLogger, transports } from 'winston';
import removeCircularReferences from 'fclone';

import { argv } from 'yargs';
import { FLUENT_HOST, FLUENT_PORT, FLUENT_TIMEOUT } from './constants';
import * as fluentLogger from 'fluent-logger';

require('winston-log-and-exit');

const isProd = process.env.NODE_ENV === 'prod';
const isECS = process.env.HEAP_ECS === 'true';

const mainFilename = (() => {
  // process.mainModule is undefined when node reads from STDIN.
  const { mainModule } = process;
  if (!mainModule) {
    return 'unknown';
  }
  const basename = path.basename(mainModule.filename);
  if (basename === 'pm2_loader.js') {
    try {
      if (typeof argv.pm2path === 'string') {
        return path.basename(argv.pm2path);
      }
    } catch (e) {
      // An error was encountered, likely because pm2path wasn't passed
      // in. In this case we'll just use pm2_loader for the mainfilename.
      return basename;
    }
  }
  return basename;
})();

const hostname = os.hostname();

const baseFormat = format((info) => {
  return {
    ...removeCircularReferences(info),
    mainFilename,
    hostname,
  };
})();

const formatsToUse = [baseFormat];

const ecsFormat = format((info) => {
  // First, check if the meta object is actually an error. In this case we want to preserve
  // the error message (which would otherwise be clobbered by the log message). Winston populates
  // the `name` field of the meta object with the class of the object if available, so just check
  // for `name === 'Error'` here.
  if (info.name === 'Error') {
    info.error_message = info.message;
    delete info.message;
    delete info.name; // This field just looks confusing.
    return info;
  }

  // Otherwise, we expect the meta object to be tags for the log line. Apply some rudimentary
  // sanitizing here to stringify unexpected nested objects. All of our tags should be either
  // string or number values.
  for (const key of Object.keys(info)) {
    const value = info[key];
    const isString = typeof value === 'string';
    const isNumber = typeof value === 'number';
    if (!isString && !isNumber) {
      info[key] = '' + JSON.stringify(value);
    }
  }

  return info;
})();

if (isProd) {
  formatsToUse.push(format.timestamp());
}

if (isECS) {
  formatsToUse.push(ecsFormat, format.json());
} else {
  // formatsToUse.push(format.colorize({ all: true }), format.simple());
  formatsToUse.push(format.simple());
}

const transportsToUse = [new transports.Console()];
if (isProd && !isECS) {
  const fluentConfig = {
    host: FLUENT_HOST,
    port: FLUENT_PORT,
    timeout: FLUENT_TIMEOUT,
  };
  const fluentTransport = fluentLogger.support.winstonTransport();
  const transport = new fluentTransport('heap.coffee', fluentConfig);
  transportsToUse.push(transport);
}

export const logger = createLogger({
  format: format.combine(...formatsToUse),
  exitOnError: false,
  transports: transportsToUse,
  level: process.env.LOG_LEVEL || 'info',
});

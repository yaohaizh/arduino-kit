const LOGGER_LEVELS = ['all', 'trace', 'debug', 'info', 'warn', 'error', 'fatal'];
const DEFAULT_LEVEL = 'info';

class Logger {
  constructor(options) {
    this.pid = options.pid || process.pid;
    this.streams = options.streams || [];
    this.levels = options.levels || LOGGER_LEVELS;
    this.currentLevel = this.levels.indexOf(options.level || DEFAULT_LEVEL);
  }

  log(level, msg) {
    const entry = this.createEntry(level, msg);
    this.streams.forEach(
      (stream) => {
        stream.write(entry);
      });
    return entry;
  }

  trace(msg) {
    return this.log('trace', msg);
  }

  debug(msg) {
    return this.debug('debug', msg);
  }

  info(msg) {
    return this.log('info', msg);
  }

  warn(msg) {
    return this.log('warn', msg);
  }

  error(msg) {
    return this.log('error', msg);
  }

  fatal(msg) {
    return this.log('fatal', msg);
  }

  createEntry(level, message) {
    const entry = {};
    entry.pid = this.pid;
    entry.level = level;
    entry.ts = Date.now();
    entry.message = message;
    return entry;
  }

  set level(value) {
    this.currentLevel = this.levels.indexOf(value);
    this.streams.forEach((stream) => {
      stream.level = value;
    });
  }
}

module.exports = {
  Logger,
  LOGGER_LEVELS,
  DEFAULT_LEVEL
};

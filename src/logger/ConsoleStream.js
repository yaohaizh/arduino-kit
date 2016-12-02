const chalk = require('chalk');
const BaseStream = require('./BaseStream');

const LOGGER_LEVELS = require('./Logger').LOGGER_LEVELS;
const DEFAULT_LEVEL = require('./Logger').DEFAULT_LEVEL;

class ConsoleStream extends BaseStream {

  constructor(options) {
    super(options);
    this.writer = options.writer || console.log;
    this.levels = options.levels || LOGGER_LEVELS;
    this.levelIndex = this.levels.indexOf(options.level || DEFAULT_LEVEL);
  }

  set level(value) {
    this.levelIndex = this.levels.indexOf(value);
  }

  formatTimestamp(timestamp) {
    return `[${chalk.green(super.formatTimestamp(timestamp))}]`;
  }

  formatMessage(entry) {
    const entryLevelIndex = this.levels.indexOf(entry.level);
    if (entryLevelIndex >= this.levels.indexOf('error')) {
      return chalk.red(super.formatMessage(entry));
    } else if (entryLevelIndex >= this.levels.indexOf('warn')) {
      return chalk.yellow(super.formatMessage(entry));
    }
    return super.formatMessage(entry);
  }

  format(entry) {
    const fields = this.formatEntry(entry);
    return fields.join(this.separator);
  }

  write(entry) {
    if (this.levels.indexOf(entry.level) >= this.levelIndex) {
      this.writer(this.format(entry));
    }
  }
}

module.exports = ConsoleStream;


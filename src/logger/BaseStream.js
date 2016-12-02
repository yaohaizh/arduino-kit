const moment = require('moment');

class BaseStream {
  constructor(options) {
    this.separator = options.separator || ' ';
    this.timestampFormat = options.timestampFormat || 'mm:ss.SS';
  }

  formatEntry(entry) {
    const fields = [];

    fields.push(this.formatTimestamp(entry.ts));
    fields.push(this.formatLevel(entry.level));
    fields.push(this.formatMessage(entry));

    return fields;
  }

  formatTimestamp(timestap) {
    return moment(timestap).format(this.timestampFormat);
  }

  formatLevel(level) {
    let str = level.toUpperCase();
    if (str.length < 5) str += ' ';
    return str;
  }

  formatMessage(entry) {
    return entry.message;
  }
}

module.exports = BaseStream;

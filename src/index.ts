import SlsField from "./slsField";
import SlsProducer from "./slsProducer";
import { LeveledLogMethod, LogMethod, SlsLoggerOptions, SlsOptions } from "./types";
import obj2str from "./utils/obj2str";

export const LEVEL_OFF = 9007199254740991;
export const LEVEL_FATAL = 50000;
export const LEVEL_ERROR = 40000;
export const LEVEL_WARN = 30000;
export const LEVEL_INFO = 20000;
export const LEVEL_DEBUG = 10000;
export const LEVEL_TRACE = 5000;
export const LEVEL_ALL = 0;
export const LEVEL_LOOKUP: { [key: string]: number } = {
  ALL: LEVEL_ALL,
  TRACE: LEVEL_TRACE,
  DEBUG: LEVEL_DEBUG,
  INFO: LEVEL_INFO,
  WARN: LEVEL_WARN,
  ERROR: LEVEL_ERROR,
  FATAL: LEVEL_FATAL,
  OFF: LEVEL_OFF,
};

class SlsLogger {
  public static createField(key: string, value: string) {
    return new SlsField(key, value);
  }
  public log: LogMethod;
  public trace: LeveledLogMethod;
  public debug: LeveledLogMethod;
  public info: LeveledLogMethod;
  public warn: LeveledLogMethod;
  public error: LeveledLogMethod;
  public fatal: LeveledLogMethod;
  private producer: SlsProducer;
  private level: number;
  private queue: Array<{ [key: string]: string }> = [];
  private producerState: "PENDING" | "READY" | "UNAVAILABLE" = "PENDING";
  constructor(opts: SlsLoggerOptions) {
    if (typeof opts.level === "string") {
      this.level = LEVEL_LOOKUP[opts.level.toUpperCase()] || LEVEL_INFO;
    } else if (typeof opts.level === "number") {
      this.level = opts.level;
    } else {
      this.level = LEVEL_INFO;
    }
    if (opts.disabled) {
      this.producerState = "UNAVAILABLE";
      this.raw = this._consoleLog;
    } else {
      this.producer = new SlsProducer(opts);
      this.producer.getLogstore().then(
        (rs) => {
          if (rs.logstoreName === opts.logstore) {
            this.producerState = "READY";
          } else {
            this.producerState = "UNAVAILABLE";
            console.warn(`Unable to initiate sls producer, expecting logstore name ${opts.logstore}, but got`, rs);
          }
        },
        (e) => {
          this.producerState = "UNAVAILABLE";
          console.warn(`Unable to initiate sls producer, error`, e);
        },
      ).then(() => {
        if (this.producerState === "UNAVAILABLE") {
          this.raw = this._consoleLog;
        } else if (this.producerState === "READY") {
          this.raw = (data) => {
            this.producer.send({
              Time: Math.floor(Date.now() / 1000),
              Contents: Object.keys(data).map((k) => ({ Key: k, Value: data[k] })),
            });
          };
        }
        // flush logs.
        this.queue.forEach((i) => this.raw(i));
        this.queue = [];
      });
    }
    this.log = (level, message, ...extra) => {
      if (typeof level === "string") {
        level = {
          level: LEVEL_LOOKUP[level.toUpperCase()] || LEVEL_INFO,
          name: level,
        };
      }
      if (level.level < this.level) { return; }
      const data: { [key: string]: string } = {};
      let logMessage = String(typeof message === "function" ? message() : message);
      for (const item of extra) {
        if (item instanceof SlsField) {
          data[item.key] = item.value;
        } else {
          logMessage += " " + obj2str(item);
        }
      }
      data.level = level.name;
      data.message = logMessage;
      this.raw(data);
    };
    this.trace = this.log.bind(this, "TRACE");
    this.debug = this.log.bind(this, "DEBUG");
    this.info = this.log.bind(this, "INFO");
    this.warn = this.log.bind(this, "WARN");
    this.error = this.log.bind(this, "ERROR");
    this.fatal = this.log.bind(this, "FATAL");
  }
  public raw(data: { [key: string]: string }) {
    this.queue.push(data);
  }
  public setLevel(level: string | number) {
    if (typeof level === "string") {
      this.level = LEVEL_LOOKUP[level.toUpperCase()] || LEVEL_INFO;
    } else if (typeof level === "number") {
      this.level = level;
    }
  }
  private _consoleLog(data: { [key: string]: string }) {
    const { level, message, ...extra } = data;
    const args: any[] = [`${level ? `[${level}] ` : ""}${message}`];
    if (Object.keys(extra).length > 0) {
      args.push(extra);
    }
    console.log.apply(null, args);
  }
}

export default SlsLogger;
export { SlsField, LeveledLogMethod, LogMethod, SlsLoggerOptions, SlsOptions };
module.exports = Object.assign(SlsLogger, module.exports);

import * as path from 'path';
import * as https from 'https';
import * as protobuf from 'protobufjs';
import * as crypto from 'crypto';
// @ts-ignore there is no typescript def for lz4.
import * as LZ4 from 'lz4';
import { LogGroup, Log, SlsOptions, SlsLoggerOptions, LogMethod, LeveledLogMethod } from './types';

export const LEVEL_OFF = 9007199254740991;
export const LEVEL_FATAL = 50000;
export const LEVEL_ERROR = 40000;
export const LEVEL_WARN = 30000;
export const LEVEL_INFO = 20000;
export const LEVEL_DEBUG = 10000;
export const LEVEL_TRACE = 5000;
export const LEVEL_ALL = 0;
const LEVEL_LOOKUP: { [key: string]: number } = {
  ALL: LEVEL_ALL,
  TRACE: LEVEL_TRACE,
  DEBUG: LEVEL_DEBUG,
  INFO: LEVEL_INFO,
  WARN: LEVEL_WARN,
  ERROR: LEVEL_ERROR,
  FATAL: LEVEL_FATAL,
  OFF: LEVEL_OFF
};

const MessageTypes = protobuf.loadSync(path.resolve(__dirname, '../sls.proto'));
const PbLogGroup = MessageTypes.lookupType("sls.LogGroup");

const DEFAULT_BULK_SIZE = 512;

const agent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 10000,
  timeout: 1000
});

class SlsProducer {
  private options: SlsOptions;
  private worker?: Promise<any>;
  private buffer: Log[] = [];
  private resource: string;
  constructor(opts: SlsOptions) {
    this.options = opts;
    this.resource = `/logstores/${this.options.logstore}/shards/lb`;
  }
  async putLogs(logGroup: LogGroup) {
    let body = PbLogGroup.encode(logGroup).finish() as Buffer;
    const rawLength = body.byteLength;
    if (this.options.compress) {
      let output = Buffer.alloc(LZ4.encodeBound(body.length));
      let compressedSize = LZ4.encodeBlock(body, output);
      body = output.slice(0, compressedSize);
    }
    const md5 = crypto.createHash('md5');
    md5.write(body);
    const bodyMd5 = md5.digest().toString('hex').toUpperCase();
    const date = (new Date()).toUTCString();
    const headers: { [header: string]: number | string } = {
      "Content-Type": "application/x-protobuf",
      "Content-Length": body.byteLength,
      "Content-MD5": bodyMd5,
      "Date": date,
      "x-log-apiversion": "0.6.0",
      "x-log-signaturemethod": "hmac-sha1",
      "x-log-bodyrawsize": rawLength
    };
    let signString = `POST\n${bodyMd5}\napplication/x-protobuf\n${date}\nx-log-apiversion:0.6.0\nx-log-bodyrawsize:${rawLength}\n`;
    if (this.options.compress) {
      headers['x-log-bodyrawsize'] = rawLength;
      headers['x-log-compresstype'] = 'lz4';
      signString += `x-log-compresstype:lz4\n`;
    }
    if (this.options.hashkey) {
      headers['x-log-hashkey'] = this.options.hashkey;
      signString += `x-log-hashkey:${this.options.hashkey}\n`;
    }
    signString += `x-log-signaturemethod:hmac-sha1\n${this.resource}`;
    const hmac = crypto.createHmac('sha1', this.options.accessSecret);
    hmac.write(signString);
    const sign = hmac.digest().toString("base64");
    headers['Authorization'] = `LOG ${this.options.accessKey}:${sign}`;

    await new Promise((f, r) => {
      let req = https.request({
        protocol: 'https:',
        hostname: this.options.endpoint,
        port: 443,
        path: this.resource,
        agent,
        method: "POST",
        headers
      }, res => {
        res.once('end', f);
      });
      req.once('error', r);
      req.write(body);
      req.end();
    });
  }
  private start() {
    if (this.worker) return;
    this.worker = (async () => {
      while (this.buffer.length > 0) {
        const logs = this.buffer.length > DEFAULT_BULK_SIZE ? this.buffer.slice(0, DEFAULT_BULK_SIZE) : this.buffer;
        this.buffer = this.buffer.length > DEFAULT_BULK_SIZE ? this.buffer.slice(DEFAULT_BULK_SIZE) : [];
        try {
          await this.putLogs({
            Logs: logs,
            Topic: this.options.topic,
            Source: this.options.source
          });
        } catch (e) {
          console.error("Unable to put logs to sls.", e);
        }
      }
      this.worker = undefined;
    })();
  }
  public send(log: Log) {
    this.buffer.push(log);
    this.start();
  }
}

function object2Str(item: any) {
  if (item === null) {
    return 'null';
  }
  if (item instanceof Error) {
    return item.stack || item.message;
  }
  if (typeof item === 'string') {
    return JSON.stringify(item);
  }
  if (typeof item !== 'object') {
    return String(item);
  }
  return '{ ' + Object.keys(item).map(k => `${k}: ${typeof item[k] === 'string' ? JSON.stringify(item[k]) : String(item[k])}`).join(", ") + ' }';
}

class SlsLogger {
  public static createField(key: string, value: string) {
    return new SlsField(key, value);
  }
  private producer: SlsProducer;
  private level: number;
  constructor(opts: SlsLoggerOptions) {
    if (typeof opts.level === 'string') {
      this.level = LEVEL_LOOKUP[opts.level.toUpperCase()] || LEVEL_INFO;
    } else if (typeof opts.level === 'number') {
      this.level = opts.level;
    } else {
      this.level = LEVEL_INFO;
    }
    this.producer = new SlsProducer(opts);
  }
  raw(data: { [key: string]: string }) {
    this.producer.send({
      Time: Math.floor(Date.now() / 1000),
      Contents: Object.keys(data).map(k => ({ Key: k, Value: data[k] }))
    });
  }
  log: LogMethod = (level, message, ...extra) => {
    if (typeof level === 'string') {
      level = {
        level: LEVEL_LOOKUP[level.toUpperCase()] || LEVEL_INFO,
        name: level
      };
    }
    if (level.level < this.level) return;
    const data: { [key: string]: string } = {};
    let logMessage = String(typeof message === 'function' ? message() : message);
    for (const item of extra) {
      if (item instanceof SlsField) {
        data[item.key] = item.value;
      } else if (item instanceof Error) {
        logMessage += ' ' + (item.stack || item.message) + '\n';
      } else if (Array.isArray(item)) {
        logMessage += ' [' + item.map(object2Str).join(', ') + ']';
      } else if (item instanceof Date) {
        logMessage += ' ' + String(item);
      } else if (typeof item === 'object') {
        logMessage += ' ' + object2Str(item);
      } else {
        logMessage += ' ' + String(item);
      }
    }
    data.level = level.name;
    data.message = logMessage;
    this.raw(data);
  }
  trace: LeveledLogMethod = this.log.bind(this, "TRACE");
  debug: LeveledLogMethod = this.log.bind(this, "DEBUG");
  info: LeveledLogMethod = this.log.bind(this, "INFO");
  warn: LeveledLogMethod = this.log.bind(this, "WARN");
  error: LeveledLogMethod = this.log.bind(this, "ERROR");
  fatal: LeveledLogMethod = this.log.bind(this, "FATAL");
}

export class SlsField {
  constructor(key: string, value: string) {
    this.key = key;
    this.value = value;
  }
  key: string;
  value: string;
}

export default SlsLogger;

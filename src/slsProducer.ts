import * as path from 'path';
import * as https from 'https';
import * as crypto from 'crypto';
import * as protobuf from 'protobufjs';
// @ts-ignore there is no typescript def for lz4.
import * as LZ4 from 'lz4';
import { LogGroup, Log, SlsOptions } from './types';

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
      }, f);
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

export default SlsProducer;

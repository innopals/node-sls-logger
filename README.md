# Logger for Aliyun SLS

[![Travis CI Build Status](https://img.shields.io/travis/innopals/node-sls-logger/master.svg)](http://travis-ci.org/innopals/node-sls-logger)
[![NPM Version](https://img.shields.io/npm/v/sls-logger.svg)](https://npmjs.org/package/sls-logger)
[![NPM Downloads](https://img.shields.io/npm/dm/sls-logger.svg)](https://npmjs.org/package/sls-logger)
[![Dependency Status](https://status.david-dm.org/gh/innopals/node-sls-logger.svg)](https://david-dm.org/innopals/node-sls-logger)

The nodejs logger for aliyun SLS with minimum dependencies.

## Configuration

| Config Name   | Default | Type            | Required | Description                                                  |
| ------------- | ------- | --------------- | -------- | ------------------------------------------------------------ |
| accessKey     |         | string          | true     | Your access key to SLS                                       |
| accessSecret  |         | string          | true     | Your secret to access SLS                                    |
| securityToken |         | string          | false    | Your STS security token                                      |
| endpoint      |         | string          | true     | Your SLS endpoint, e.g. example.cn-hangzhou.log.aliyuncs.com |
| logstore      |         | string          | true     | Your logstore name                                           |
| source        |         | string          | false    | Source for your logs                                         |
| topic         |         | string          | false    | Topic for your logs                                          |
| hashkey       |         | string          | false    |                                                              |
| compress      | false   | boolean         | false    | Use lz4 to compress log payload                              |
| tags          |         | key-value pair  | false    | Extra tags for your logs                                     |
| level         | INFO    | string / number | false    | Log level                                                    |
| disabled      | false   | boolean         | false    | Disable sls and log to stdout                                |

Note: if your configuration is incorrect(fail to get logstore), all logs will be written to stdout.

## Usage

```javascript
const logger = new SlsLogger({
  endpoint: "example.cn-hangzhou.log.aliyuncs.com",
  accessKey: "your_access_key",
  accessSecret: "your_access_secret",
  logstore: "your_logstore",
  source: "test",
  topic: "test",
  compress: true,
  level: "INFO",
  disabled: true,
});

logger.info(
  "Hello world!",
  new Date(),
  function () { "abc"; },
  { a: 1, b: { c: 1 }, d: "123", e: false },
  new Object(),
  [1, 2, 3, "abc", false, null, undefined, new Error("error1")],
  SlsLogger.createField("module", "main"),
  1234,
  true,
  null,
  undefined,
  new Error("error2")
);
```

And you can pass a function as log message generator to improve performance; it will not be called unless the log level is enabled.

``` js
logger.debug(
  () => "Debug message from generator.",
  SlsLogger.createField("module", "debug")
);
// Set log level on the fly, e.g. through user signal or rest api.
logger.setLevel("DEBUG");
```

## Contributing

This project welcomes contributions from the community. Contributions are accepted using GitHub pull requests. If you're not familiar with making GitHub pull requests, please refer to the [GitHub documentation "Creating a pull request"](https://help.github.com/articles/creating-a-pull-request/).

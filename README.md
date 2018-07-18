# LoGik

NodeJS module for fast async writing text logs from all workers to the one text file.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

### Prerequisites

What things you need to install the software and how to install them

```
Give examples
```

### Installing

Installing process

```
npm install logik
```
### Running

```
const TRACE = 0,
      DEBUG = 1,
      INFO = 2,
      WARN = 3,
      ERROR = 4,
      SILENT = 5;
    
const logik = require('logik)({
  filename: './logs/main.log',
  level: INFO,
  stdout: false
});

logik.info('MainCls.get params: {1}, fields: {2}', params, fields);
// 2018-07-18T03:36:06.272Z - INFO: MainCls.get params: {"param1": "val1"}, fields: {"field1": "val1"}
logik.debug(...);
logik.info(...);
logik.warn(...);
logik.error(...);


```

## Authors

* **Alexey Sviridov** - *Initial work* - [rimdus](https://github.com/rimdus)

See also the list of [contributors](https://github.com/your/project/contributors) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Acknowledgments

* Hat tip to anyone whose code was used
* Inspiration
* etc

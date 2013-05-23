var server = require("./server.js").server;
var config = require('./config.local.js').config;
server.start(config);
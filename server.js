
var _url = require('url');
var _http = require('http');
var _mysql = require('node-mysql');

var handler = function (req, res) {
    res.setHeader('Content-Type' : 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({success: false}));
};

_http.createServer(handler).listen(process.env.PORT);

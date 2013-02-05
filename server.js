
var _url = require('url');
var _http = require('http');

var handler = function (req, res) {

    res.setHeader('Content-Type' : 'application/json');

    var handled = false;

    res.statusCode = 200;
    res.end(JSON.stringify({success: false}));
};

_http.createServer(handler).listen(80);

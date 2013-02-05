
var _url = require('url');
var _http = require('http');

var handler = function (req, res) {

    res.setHeader('Content-Type' : 'application/json');

    var handled = false;

    res.statusCode = 200;
    res.write(JSON.stringify({success: false}));

    res.end();
};

_http.createServer(handler).listen(80);

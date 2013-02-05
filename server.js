
var _url = require('url');
var _http = require('http');


handler = function(req, res) {
    
    res.setHeader('Content-Type' : 'application/json');
    allowCrossDomain(req, res);
    
    var handled = false;

    res.statusCode = 200;
    res.end(JSON.stringify({success: false}));

};

var allowCrossDomain = function (req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

_http.createServer(handler).listen(80);

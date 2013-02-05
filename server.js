
var _url = require('url');
var _http = require('http');

var handler = function (req, res) {
    res.writeHead(200, {'Content-Type' : 'application/json'});
    res.write(JSON.stringify({success: false}));
    res.end();
};

_http.createServer(handler).listen(process.env.PORT);

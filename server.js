
var http = require('http');

var handler = function (req, res) {
    res.setHeader('Content-Type' : 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({success: false}));
};

http.createServer(handler).listen(process.env.PORT);

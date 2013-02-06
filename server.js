
var _url = require('url');
var _http = require('http');
var _mysql = require('mysql');

var handler = function (req, res) {

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    var handled = false;

    path = _url.parse(req.url).pathname.split('/');

    if (path.length >= 2) {
        switch (path[path.length - 2]) {
            case 'board':
                switch (path[path.length - 1]) {
                    case 'add':
                        break;
                    case 'poll':
                        break;
                }
                break;
            case 'auth':
                switch (path[path.length - 1]) {
                    case 'identify':
                        handled = true;

                        var cstr = process.env["MYSQLCONNSTR_notepanel"].split(';');
                        var cobj = {};
                        for (var i = 0, imax = cstr.length; i < imax; i++) {
                            var parts = cstr[i].split('=');
                            cobj[parts[0]] = parts[1];
                        }
                        
                        var connection = _mysql.createConnection(cobj);
                        connection.connect();

                        connection.query('SELECT * FROM user;', function(err, rows, fields) {
                            var body = {};
                            body.sucess = true;
                            body.err = err;
                            body.rows = rows;
                            body.fields = fields;
                            res.statusCode = 200;
                            res.end(JSON.stringify(body));
                        });

                        connection.end();

                        break;
                }
                break;
        }
    }

    if (!handled) {
        res.statusCode = 404;
        res.end(JSON.stringify({success: false}));
    }
};

_http.createServer(handler).listen(process.env.PORT || 5001);

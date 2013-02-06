
var _url = require('url');
var _http = require('http');
var _mysql = require('mysql');
var _cookies = require('cookies');

var parseConnectionString = function (str) {
    var parts = str.split(';');
    var obj = {};
    for (var i = 0, imax = parts.length; i < imax; i++) {
        var kv = parts[i].split('=');
        obj[kv[0]] = kv[1];
    }
    return obj;
};

var getMySqlConnection = function () {
    var cs = parseConnectionString(process.env["MYSQLCONNSTR_notepanel"]);
    return _mysql.createConnection({
        host: cs["Data Source"],
        user: cs["User Id"],
        password: cs["Password"],
        database: cs["Database"]
    });
};

var handler = function (req, res) {

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    var handled = false;
    res.statusCode = 200;
    
    path = _url.parse(req.url, true).pathname.split('/');

    if (path.length > 0) {
        switch (path[0]) {
            case 'boards':
                if (path.length > 1) {
                    switch (path[1]) {
                        case 'poll':
                            break;
                    }
                }
                break;
            case 'users':
                if (path.length > 1) {
                    switch (path[1]) {
                        case 'login':
                            handled = true;
                            var body = {};
                            var cnx = getMySqlConnection();
                            cnx.connect();
                            cnx.query(
                                'SELECT id, email, name FROM user WHERE name = ? AND MD5(password) = ?;',
                                [path.query.username, path.query.password],
                                function(err, rows, fields) {
                                    if (err) {
                                        body.success = false;
                                    } else {
                                        body.success = true;
                                        if (rows.length > 0) {
                                            body.identified = true;
                                            body.user = rows[0];
                                            cookies.set('notepanel_services_user', body.user['id'], {signed: true});
                                        }
                                    }
                                    res.end(JSON.stringify(body));
                                });
                            cnx.end();
                            break;
                        case 'identify':
                            handled = true;
                            var body = {};
                            var cookie = cookies.get('notepanel_services_user', {signed: true});
                            if (cookie) {
                                var cnx = getMySqlConnection();
                                cnx.connect();
                                cnx.query('SELECT id, email, name FROM user WHERE id = ?;', [cookie], function(err, rows, fields) {
                                    if (err) {
                                        body.success = false;
                                    } else {
                                        body.success = true;
                                        if (rows.length > 0) {
                                            body.identified = true;
                                            body.user = rows[0];
                                        }
                                    }
                                    res.end(JSON.stringify(body));
                                });
                                cnx.end();
                            }
                            break;
                    }
                }
                break;
        }
    }

    if (!handled) {
        res.statusCode = 404;
        res.end();
    }
};

_http.createServer(handler).listen(process.env.PORT || 5001);

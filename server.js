var _url = require('url');
var _http = require('http');
var _cookies = require('cookies');
var _keygrip = require('keygrip');
var _data = require('./data.js');
var _querystring = require('querystring');

var settings = {
    connectionString: process.env['MYSQLCONNSTR_notepanel'] || 'Data Source=localhost;User Id=root;Password=;Database=notepanel',
    port: process.env['PORT'] || 5001,
    secrets: [
        'jhgjfgjgfjgfjj',
        'vfvcvwxcvwxcvwxcv'
    ]
};

var setCurrentUserId = function (cookies, userId) {
    cookies.set('notepanel_services_user', userId, {signed: true});
};

var getCurrentUserId = function (cookies) {
    return cookies.get('notepanel_services_user', {signed: true});
};

var listener = function (request, response) {

    context = {
        request: request,
        response: response,
        path: _url.parse(request.url, true),
        cookies: new _cookies(request, response, _keygrip(settings.secrets)),
        body: ''
    };

    request.addListener('data', function (chunk) {
        context.body += chunk;
    });
    
    request.addListener("end", function () {
        
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (context.body.length > 0) {
            context.content = _querystring.parse(context.body);
        }
        
        handleRequest(context);
    });
};

var handleRequest = function (context) {
    var handled = false;
    
    var routes = [
        {pattern: /^\/users\/login$/g, method: 'GET', handler: onUsersLogin},
        {pattern: /^\/users\/logout$/g, method: 'GET', handler: onUsersLogout},
        {pattern: /^\/users\/identify$/g, method: 'GET', handler: onUsersIdentify},
        {pattern: /^\/boards\/poll$/g, method: 'GET', handler: onBoardsPoll},
        {pattern: /^\/notes$/g, method: 'POST', handler: onNotes}
    ];

    for (var i = 0, imax = routes.length; i < imax; i++) {
        if (context.path.pathname.match(routes[i].pattern) && routes[i].method === context.request.method) {
            routes[i].handler(context, function (error, result) {
                if (error) {
                    context.response.statusCode = 500;
                    context.response.write(JSON.stringify({success: false, message: error}));
                } else {
                    context.response.statusCode = 200;
                    context.response.write(JSON.stringify({success: true, message: result}));
                }
                context.response.end();
            });
            handled = true;
            break;
        }
    }

    if (!handled) {
        context.response.statusCode = 404;
        context.response.end();
    }
};

var onUsersLogin = function (context, callback) {
    var cnx = _data.getMySqlConnection();
    cnx.connect();
    _data.getUserByNameAndPassword(cnx, context.path.query.username, context.path.query.password,
        function(error, result) {
            if (error) {
                cnx.end();
                callback(error);
            } else {
                if (result) {
                    setCurrentUserId(context.cookies, result['id']);
                    var message = {identified: true, user: result};
                    _data.listBoardsByUserId(cnx, message.user.id,
                        function(error, result) {
                            if (error) {
                                callback(error);
                            } else {
                                message.boards = result;
                                callback(null, message);
                            }
                        });
                    cnx.end();
                } else {
                    cnx.end();
                    callback(null, {identified: false});
                }
            }
        });
};

var onUsersLogout = function (context, callback) {
    var userId = getCurrentUserId(context.cookies);
    if (userId) {
        setCurrentUserId(context.cookies);
    }
    callback(null, {identified: false});
};

var onUsersIdentify = function (context, callback) {
    var userId = getCurrentUserId(context.cookies);
    if (userId) {
        var cnx = _data.getMySqlConnection();
        cnx.connect();
        _data.getUserById(cnx, userId,
            function(error, result) {
                if (error) {
                    cnx.end();
                    callback(error);
                } else {
                    if (result) {
                        var message = {identified: true, user: result};
                        _data.listBoardsByUserId(cnx, message.user.id,
                            function(error, result) {
                                if (error) {
                                    callback(error);
                                } else {
                                    message.boards = result;
                                    callback(null, message);
                                }
                            });
                        cnx.end();
                    } else {
                        cnx.end();
                        callback(null, {identified: false});
                    }
                }
                
            });
    } else {
        callback(null, {identified: false});
    }
};

var onNotes = function (context, callback) {
    var cnx = _data.getMySqlConnection();
    cnx.connect();
    _data.saveNote(cnx, context.content,
        function(error, result) {
            if (error) {
                callback(error);
            } else {
                callback(null, {id: result});
            }
        });
    cnx.end();
};

var onBoardsPoll = function (context, callback) {
    var message = {};
    callback(null, message);
};

_http.createServer(listener).listen(settings.port);

exports.settings = settings;

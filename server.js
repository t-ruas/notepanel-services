var _url = require('url');
var _http = require('http');
var _cookies = require('cookies');
var _keygrip = require('keygrip');
var _data = require('./data.js');
var _winston = require('winston');
var _moment = require('moment');

var settings = {
    connectionString: process.env['MYSQLCONNSTR_notepanel'] || 'Data Source=localhost;User Id=root;Password=;Database=notepanel',
    port: process.env['PORT'] || 5001,
    secrets: [
        'jhgjfgjgfjgfjj',
        'vfvcvwxcvwxcvwxcv'
    ]
};
exports.settings = settings;

var logger = new _winston.Logger({
    transports: [
        new _winston.transports.Console({timestamp: true}),
        new _winston.transports.File({filename: _moment().format('YYYYMMDD') + '.log'})
    ]
});
exports.logger = logger;

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

        response.setHeader('content-type', 'application/json');
        response.setHeader('access-control-allow-origin', '*');
        response.setHeader('access-control-allow-methods', 'GET, PUT, POST, DELETE');
        response.setHeader('access-control-allow-headers', 'content-type, accept');
        response.setHeader('access-control-max-age', 10);

        if (context.body.length > 0) {
            context.content = JSON.parse(context.body);
        }

        handleRequest(context);
    });
};

var handleRequest = function (context) {

    process.on('uncaughtException', function (error) {
        logger.error('uncaught exception: ' + error);
        context.response.statusCode = 500;
        context.response.end(JSON.stringify({text: error}));
    });

    var handled = false;

    var routes = [
        {pattern: /^\/users\/login$/g, method: 'GET', handler: onUsersLogin},
        {pattern: /^\/users\/logout$/g, method: 'GET', handler: onUsersLogout},
        {pattern: /^\/users\/identify$/g, method: 'GET', handler: onUsersIdentify},
        {pattern: /^\/users$/g, method: 'POST', handler: onUsers},
        {pattern: /^\/boards\/poll$/g, method: 'GET', handler: onBoardsPoll},
        {pattern: /^\/notes$/g, method: 'POST', handler: onNotes},
    ];

    for (var i = 0, imax = routes.length; i < imax; i++) {
        if (routes[i].method === context.request.method && context.path.pathname.match(routes[i].pattern)) {
            routes[i].handler(context, function (error, result) {
                if (error) {
                    logger.error(error);
                    context.response.statusCode = 500;
                    context.response.end(JSON.stringify(error));
                } else {
                    context.response.statusCode = result.code;
                    context.response.end(JSON.stringify(result.message));
                }
            });
            handled = true;
            break;
        }
    }

    if (!handled) {
        logger.warn('not found : ' + context.request.url);
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
                var message = {};
                if (result) {
                    setCurrentUserId(context.cookies, result['id']);
                    message.user = result;
                    _data.listBoardsByUserId(cnx, message.user.id,
                        function(error, result) {
                            if (error) {
                                callback(error);
                            } else {
                                message.boards = result;
                                callback(null, {code: 200, message: message});
                            }
                        });
                    _data.updateUserLoginDate(cnx, message.user.id,
                        function(error, result) {});
                    cnx.end();
                } else {
                    cnx.end();
                    callback(null, {code: 403});
                }
            }
        });
};

var onUsers = function (context, callback) {
    var cnx = _data.getMySqlConnection();
    cnx.connect();
    _data.saveUser(cnx, context.content,
        function(error, result) {
            if (error) {
                callback(error);
            } else {
                setCurrentUserId(context.cookies, result);
                callback(null, {code: 200, message: {id: result}});
            }
        });
    cnx.end();
};

var onUsersLogout = function (context, callback) {
    var userId = getCurrentUserId(context.cookies);
    if (userId) {
        setCurrentUserId(context.cookies);
    }
    callback(null, {code: 200});
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
                        var message = {user: result};
                        _data.listBoardsByUserId(cnx, message.user.id,
                            function(error, result) {
                                if (error) {
                                    callback(error);
                                } else {
                                    message.boards = result;
                                    callback(null, {code: 200, message: message});
                                }
                            });
                        cnx.end();
                    } else {
                        cnx.end();
                        callback(null, {code: 403});
                    }
                }
            });
    } else {
        callback(null, {code: 403});
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
                callback(null, {code: 200, message: {id: result}});
            }
        });
    cnx.end();
};

var onBoardsPoll = function (context, callback) {
    callback(null, {code: 200, message: {}});
};

_http.createServer(listener).listen(settings.port);

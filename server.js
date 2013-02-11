var _url = require('url');
var _http = require('http');
var _cookies = require('cookies');
var _keygrip = require('keygrip');
var _data = require('./data.js');
var _winston = require('winston');
var _moment = require('moment');
//var _events = require('events');

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

    request.addListener('end', function () {

        response.setHeader('content-type', 'application/json');
        response.setHeader('access-control-allow-origin', request.headers.origin);
        response.setHeader('access-control-allow-methods', 'GET, PUT, POST, DELETE');
        response.setHeader('access-control-allow-headers', 'content-type, accept');
        response.setHeader('access-control-allow-credentials', true);
        response.setHeader('access-control-max-age', 10);

        if (context.body.length > 0) {
            context.content = JSON.parse(context.body);
        }

        handleRequest(context);
    });
};

var handleRequest = function (context) {
/*
    process.addListener('uncaughtException', function (error) {
        logger.error('uncaught exception: ' + error);
        context.response.statusCode = 500;
        context.response.end(JSON.stringify({text: error}));
    });
*/
    var handled = false;

    var routes = [
        {pattern: /^\/users\/login$/g, method: 'GET', handler: onUsersLogin},
        {pattern: /^\/users\/logout$/g, method: 'GET', handler: onUsersLogout},
        {pattern: /^\/users\/identify$/g, method: 'GET', restricted: true, handler: onUsersIdentify},
        {pattern: /^\/users$/g, method: 'POST', restricted: true, handler: onUsers},
        {pattern: /^\/boards$/g, method: 'GET', restricted: true, handler: onGetBoards},
        {pattern: /^\/boards$/g, method: 'POST', restricted: true, handler: onPostBoards},
        {pattern: /^\/boards\/poll$/g, method: 'GET', restricted: true, handler: onBoardsPoll},
        {pattern: /^\/notes$/g, method: 'POST', restricted: true, handler: onPostNotes},
        {pattern: /^\/notes$/g, method: 'GET', restricted: true, handler: onGetNotes},
        {pattern: /^\/logs$/g, method: 'GET', handler: onGetLogs}
    ];

    for (var i = 0, imax = routes.length; i < imax; i++) {
        if (routes[i].method === context.request.method && context.path.pathname.match(routes[i].pattern)) {
            var authorized = true;
            if (routes[i].restricted) {
                context.userId = getCurrentUserId(context.cookies);
                if (!context.userId) {
                    context.response.statusCode = 403;
                    context.response.end();
                    authorized = false;
                }
            }
            if (authorized) {
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
            }
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
                    var user = result;
                    setCurrentUserId(context.cookies, user.id);
                    _data.updateUserLoginDate(cnx, user.id,
                        function(error, result) {
                            callback(null, {code: 200, message: user});
                        });
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
    if (context.userId) {
        setCurrentUserId(context.cookies);
    }
    callback(null, {code: 200});
};

var onUsersIdentify = function (context, callback) {
    var cnx = _data.getMySqlConnection();
    cnx.connect();
    _data.getUserById(cnx, context.userId,
        function(error, result) {
            if (error) {
                cnx.end();
                callback(error);
            } else {
                if (result) {
                    callback(null, {code: 200, message: result});
                } else {
                    callback(null, {code: 403});
                }
            }
        });
    cnx.end();
};

var onGetBoards = function (context, callback) {
    var cnx = _data.getMySqlConnection();
    _data.listBoardsByUserId(cnx, context.userId,
        function(error, result) {
            if (error) {
                callback(error);
            } else {
                callback(null, {code: 200, message: result});
            }
        });
    cnx.end();
};

var onPostBoards = function (context, callback) {
    var board = context.content;
    var cnx = _data.getMySqlConnection();
    cnx.connect();
    if (board.id) {
        _data.editBoard(cnx, board,
            function(error, result) {
                if (error) {
                    callback(error);
                } else {
                    callback(null, {code: 200});
                }
            });
        cnx.end();
    } else {
        _data.addBoard(cnx, board,
            function(error, result) {
                if (error) {
                    callback(error);
                } else {
                    var boardId = result;
                    _data.linkBoardAndUser(cnx, context.userId, boardId,
                        function(error, result) {
                            if (error) {
                                callback(error);
                            } else {
                                callback(null, {code: 200, message: {id: boardId}});
                            }
                        });
                }
                cnx.end();
            });
    }
};

var onGetNotes = function (context, callback) {
    var boardId = parseInt(context.path.query.boardId);
    if (isNaN(boardId)) {
        callback(null, {code: 400});
    } else {
        // get the cache version now rather than on callback
        // better to have to replay some updates than miss the ones occuring between the select and the callback
        var version = boardVersioning.getCache(boardId).version;
        var cnx = _data.getMySqlConnection();
        cnx.connect();
        _data.listNotesByBoardId(cnx, boardId,
            function(error, result) {
                if (error) {
                    callback(error);
                } else {
                    callback(null, {code: 200, message: {notes: result, version: version}});
                }
            });
        cnx.end();
    }
};

var onPostNotes = function (context, callback) {
    var note = context.content;
    var cnx = _data.getMySqlConnection();
    cnx.connect();
    _data.saveNote(cnx, note,
        function(error, result) {
            if (error) {
                callback(error);
            } else {
                note.id = result;
                boardVersioning.update(note);
                callback(null, {code: 200, message: {id: note.id}});
            }
        });
    cnx.end();
};

var onGetLogs = function (context, callback) {
    logger.query(null,
        function (error, results) {
            if (error) {
                callback(error);
            } else {
                callback(null, {code: 200, message: results});
            }
        });
};

var onBoardsPoll = function (context, callback) {
    var boardId = context.path.query.boardId;
    var version = context.path.query.version;
    var updates = boardVersioning.getUpdates(boardId, version);
    if (updates.length) {
        callback(null, {code: 200, message: updates});
    } else {
        var client = {
            callback: callback
        };
        boardVersioning.getCache(boardId).clients.push(client);
        // TODO
        /*context.request.addListener('close', function ()
        {
        });*/
    }
};

var boardVersioning = {
    queueSize: 10,
    cache: {},

    getCache: function (boardId) {
        if (!(boardId in boardVersioning.cache)) {
            boardVersioning.cache[boardId] = {
                version: 0,
                updates: [],
                clients: []
            };
        }
        return boardVersioning.cache[boardId];
    },
    
    update: function (note) {
        var cache = boardVersioning.getCache(note.boardId)
        cache.version++;
        var update = {
            version: cache.version,
            note: note
        };
        if (cache.updates.length === boardVersioning.queueSize) {
            cache.updates.shift();
        }
        cache.updates.push(update);
        var updates = [update];
        for (var i = 0, imax = cache.clients.length; i < imax; i++) {
            cache.clients[i].callback(null, {code: 200, message: updates});
        }
        cache.clients.length = 0;
    },

    getUpdates: function (boardId, version) {
        var list = [];
        var cache = boardVersioning.getCache(boardId);
        if (cache.version > version) {
            for (var i = cache.updates.length - 1; i >= 0; i--) {
                if (cache.updates[i].version > version) {
                    list.push(cache.updates[i])
                } else {
                    break;
                }
            }
        }
        return list;
    }
};

_http.createServer(listener).listen(settings.port);

var _url = require('url');
var _http = require('http');
var _cookies = require('cookies');
var _enums = require('./enums.js');
var _data = require('./data.js');
var _winston = require('winston');
var _moment = require('moment');
var _crypto = require('crypto');

var settings = {
    connectionString: process.env['MYSQLCONNSTR_notepanel'] || 'Data Source=localhost;User Id=root;Password=;Database=notepanel',
    port: process.env['PORT'] || 5001,
    secret: process.env['secret'] || 'super123RFSDGTa$^rpùdf',
    // Default cookie salt set by Flask.
    salt: 'cookie-session'
};
exports.settings = settings;

var logger = new _winston.Logger({
    transports: [
        new _winston.transports.Console({timestamp: true}),
        new _winston.transports.File({filename: _moment().format('YYYYMMDD') + '.log'})
    ]
});
exports.logger = logger;

var deriveKey = function () {
    // Flask default hmac mode.
    var hmac = _crypto.createHmac('sha1', new Buffer(settings.secret, 'utf8'));
    hmac.update(settings.salt);
    return hmac.digest();
};

var getSignature = function (value) {
    var key = deriveKey();
    var hmac = _crypto.createHmac('sha1', key);
    hmac.update(value);
    return hmac.digest('base64');
};

// Verify and decode session cookie as in python side itsdangerous.Signer.
// eyJib2FyZF9pZCI6IjEiLCJ1c2VyX2lkIjoxfQ.BBdOnw.w_hHRZ63eKkB6KQlVPBRjTNfWD4
var decryptCookie = function (str) {
    logger.info('str ==> ' + str);
    var u = str.lastIndexOf('.');
    if (u >= 0) {
        var value = str.substr(0, u);
        logger.info('value ==> ' + value);
        var sig = getSignature(value);
        logger.info('sig ==> ' + sig);
        while (sig.charAt(sig.length - 1) === '=') {
            sig = sig.slice(0, -1);
        }
        // Python urlsafe_b64decode.
        sig = sig.replace(/\+/g, '-').replace(/\//g, '_');
        logger.info('sig ==> ' + sig);
        if (sig === str.substr(u + 1)) {
            var v = value.indexOf('.');
            if (v >= 0) {
                var content = new Buffer(value.substr(0, v), 'base64').toString('utf8');
                return JSON.parse(content);
            }
        }
    }
    logger.info('failed to verify session cookie');
};

var listener = function (request, response) {

    context = {
        request: request,
        response: response,
        path: _url.parse(request.url, true),
        cookies: new _cookies(request, response),
        body: '',
        session: null
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

    logger.info('----> ' + context.request.method + ' ' + context.path.pathname);

    // comment for Azure
    /*
    process.addListener('uncaughtException', function (error) {
        logger.error('uncaught exception: ' + error);
        // TODO : log stacktrace
        if(error.text) {
            logger.error(error.text);
        }
        context.response.statusCode = 500;
        context.response.end(JSON.stringify({text: error}));
    });
    */
    
    var handled = false;

    var routes = [
        {pattern: /^\/.*$/g, method: 'OPTIONS', handler: onOptions},
        {pattern: /^\/notes\/poll\/([0-9]+)$/g, method: 'GET', restricted: true, handler: onGetNotesPoll},
        {pattern: /^\/notes$/g, method: 'GET', restricted: true, handler: onGetNotes},
        {pattern: /^\/notes$/g, method: 'PUT', restricted: true, handler: onPutNotes},
        {pattern: /^\/notes\/([0-9]+)$/g, method: 'POST', restricted: true, handler: onPostNotes},
        {pattern: /^\/notes\/([0-9]+)$/g, method: 'DELETE', restricted: true, handler: onDeleteNotes},
        {pattern: /^\/logs$/g, method: 'GET', handler: onGetLogs}
    ];

    for (var i = 0, imax = routes.length; i < imax; i++) {
        if (routes[i].method === context.request.method) {
            var matches = routes[i].pattern.exec(context.path.pathname);
            if (matches) {
                //logger.info('cookies ==> ' + JSON.stringify(context.cookies.get('session')));
                var session = context.cookies.get('session');
                if (session) {
                    context.session = decryptCookie(session);
                }
                logger.info('session cookie ==> ' + JSON.stringify(context.session));
                var authorized = true;
                if (routes[i].restricted) {
                    if (!context.session) {
                        context.response.statusCode = 403;
                        context.response.end();
                        authorized = false;
                    }
                }
                if (authorized) {
                    // Convert values to integers when possible.
                    for (var j = 1; j < matches.length; j++) {
                        var u = parseInt(matches[j]);
                        if (!isNaN(u)) {
                            matches[j] = u;
                        }
                    }
                    // Remove main regexp match from the array, leaving only the searched groups.
                    matches.splice(0, 1, context, function (error, result) {
                        if (error) {
                            logger.error(error);
                            // TODO : log stacktrace
                            if(error.text) {
                                logger.error(error.text);
                            }
                            context.response.statusCode = 500;
                            context.response.end(JSON.stringify(error));
                        } else {
                            context.response.statusCode = result.code;
                            context.response.end(JSON.stringify(result.message));
                        }
                    });
                    routes[i].handler.apply(this, matches);
                }
                handled = true;
                break;
            }
        }
    }

    if (!handled) {
        context.response.statusCode = 404;
        context.response.end();
    }
};

var onOptions = function (context, callback) {
    callback(null, {code: 200});
};

var onGetNotes = function (context, callback) {
    // get the cache version now rather than on callback
    // better to have to replay some updates than miss the ones occuring between the select and the callback
    var version = boardVersioning.getCache(context.session.board_id).version;
    var cnx = _data.getMySqlConnection();
    cnx.connect();
    _data.listNotesByBoardId(cnx, context.session.board_id,
        function(error, notes) {
            if (error) {
                callback(error);
            } else {
                callback(null, {code: 200, message: {notes: notes, version: version}});
            }
            cnx.end();
        });
};

var onPostNotes = function (context, callback, noteId) {
    var note = context.content;
    var fun;
    switch (note.update) {
        case _enums.noteUpdateType.POSITION: fun = _data.updateNotePosition; break;
        case _enums.noteUpdateType.VALUE: fun = _data.updateNoteValue; break;
        case _enums.noteUpdateType.RIGHTS: fun = _data.updateNoteRights; break;
    }
    if (fun) {
        var cnx = _data.getMySqlConnection();
        cnx.connect();
        fun(cnx, note,
            function (error, result) {
                if (error) {
                    callback(error);
                } else {
                    boardVersioning.update(context.session.board_id, note);
                    callback(null, {code: 200});
                }
            });
        cnx.end();
    }
};

var onPutNotes = function (context, callback) {
    var note = context.content;
    var cnx = _data.getMySqlConnection();
    cnx.connect();
    _data.addNote(cnx, context.session.board_id, note,
        function (error, result) {
            if (error) {
                callback(error);
            } else {
                boardVersioning.update(context.session.board_id, note);
                callback(null, {code: 200, message: {id: note.id}});
            }
        });
    cnx.end();
};

var onDeleteNotes = function (context, callback, noteId) {
    var cnx = _data.getMySqlConnection();
    cnx.connect();
    _data.deleteNote(cnx, context.session.board_id, noteId,
        function(error, result) {
            if (error) {
                callback(error);
            } else {
                boardVersioning.update(context.session.board_id, {
                    id: noteId,
                    update: _enums.noteUpdateType.REMOVE
                });
                callback(null, {code: 200});
            }
        });
    cnx.end();
};

var onGetNotesPoll = function (context, callback, version) {
    logger.info('onGetNotesPoll board ' + context.session.board_id + ' version ' + version); 
    var updates = boardVersioning.getUpdates(context.session.board_id, version);
    logger.info("onGetNotesPoll updates.length : " + updates.length); 
    if (updates.length) {
        callback(null, {code: 200, message: updates});
    } else {
        boardVersioning.addClient(context.session.board_id, context.session.user_id, callback);
        context.request.addListener('close', function () {
            boardVersioning.removeClient(context.session.board_id, context.session.user_id);
        });
    }
};

var boardVersioning = {
    queueSize: 10,
    cache: {},

    addClient: function (boardId, userId, callback) {
        var cache = boardVersioning.getCache(boardId);
        cache.clients.push({
            userId: userId,
            callback: callback
        });
        logger.info('added client ' + userId + ' for board ' + boardId);
    },

    removeClient: function (boardId, userId) {
        if (boardId in boardVersioning.cache) {
            var cache = boardVersioning.cache[boardId];
            for (var i = 0, imax = cache.clients.length; i < imax; i++) {
                if (cache.clients[i].userId === userId) {
                    cache.clients.splice(i, 1);
                    break;
                }
            }
            logger.info('removed client ' + userId + ' for board ' + boardId);
        }
    },

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

    update: function (boardId, note) {
        logger.info('version update on board ' + boardId + ' for note ' + note.id);
        var cache = boardVersioning.getCache(boardId);
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
            logger.info('version notification for client ' + cache.clients[i].userId);
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

_http.createServer(listener).listen(settings.port);

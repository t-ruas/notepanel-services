var _url = require('url');
var _http = require('http');
var _cookies = require('cookies');
var _keygrip = require('keygrip');
var _enums = require('./enums.js');
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

    // comment for Azure    
    process.addListener('uncaughtException', function (error) {
        logger.error('uncaught exception: ' + error);
        // TODO : log stacktrace
        if(error.text) {
            logger.error(error.text);
        }
        context.response.statusCode = 500;
        context.response.end(JSON.stringify({text: error}));
    });

    var handled = false;

    var routes = [
        {pattern: /^\/.*$/g, method: 'OPTIONS', handler: onOptions},
        {pattern: /^\/users\/login$/g, method: 'GET', handler: onUsersLogin},
        {pattern: /^\/users\/logout$/g, method: 'GET', handler: onUsersLogout},
        {pattern: /^\/users\/identify$/g, method: 'GET', restricted: true, handler: onUsersIdentify},
        {pattern: /^\/users$/g, method: 'POST', restricted: true, handler: onUsers},
        {pattern: /^\/boards$/g, method: 'GET', restricted: true, handler: onGetBoards},
        {pattern: /^\/boards$/g, method: 'POST', restricted: true, handler: onPostBoards},
        {pattern: /^\/boards\/poll$/g, method: 'GET', restricted: true, handler: onBoardsPoll},
        {pattern: /^\/boards\/users$/g, method: 'GET', restricted: true, handler: onGetBoardsUsers},
        {pattern: /^\/notes$/g, method: 'POST', restricted: true, handler: onPostNotes},
        {pattern: /^\/notes$/g, method: 'GET', restricted: true, handler: onGetNotes},
        {pattern: /^\/notes$/g, method: 'DELETE', restricted: true, handler: onDeleteNotes},
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

var onOptions = function (context, callback) {
    callback(null, {code: 200});
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

var onGetBoardsUsers = function (context, callback) {
    var boardId = parseInt(context.path.query.boardId);
    var cnx = _data.getMySqlConnection();
    _data.listBoardsUsersByBoardId(cnx, boardId,
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
        var userId = getCurrentUserId(context.cookies);
        var cnx = _data.getMySqlConnection();
        cnx.connect();
        _data.getBoardWithUsersWithNotes(cnx, boardId,
            function(error, board) {
                if (error) {
                    callback(error);
                } else {
                    // add board to cache
                    /*
                    boardCache.add(board);
                    */
                    var notes = [];
                    for(var iNote in board.notes) {
                        var note = board.notes[iNote];
                        var lightNote = {
                            id: note.id,
                            boardId: note.boardId,
                            userId: note.userId,
                            value: note.value,
                            width: note.width,
                            height: note.height,
                            x: note.x,
                            y: note.y,
                            z: note.z,
                            template: note.template
                        };
                        lightNote.options = calculateBoardNoteOptions(board, userId, note); // set actual options of the note for the current user
                        notes.push(lightNote);
                    }
                    callback(null, {code: 200, message: {notes: notes, version: version}});
                }
                cnx.end();
            });
    }
};

var getUserInBoard = function(board, userId) {
    for(var iUser in board.users) {
        if(board.users[iUser].id == userId)
            return board.users[iUser];
    }
    return null;
}

// calculate note option for a user (logged or not) according to the board privacy
var calculateBoardNoteOptions = function(board, userId, note) {
    var options = 0;    
    var user = getUserInBoard(board, userId);
    switch (board.privacy) {
        case _enums.boardPrivacies.PUBLIC:
            if(user) { // user is a user of this board
                options = calculateNoteOptions(user, note);
            } else { // user is not a user of this board (logged or not)
                options = _enums.noteOptions.NONE;
            }
            break;
        case _enums.boardPrivacies.INTERNAL_READONLY:
            if(user) { // user is a user of this board
                options = calculateNoteOptions(user, note);
            } else { // user is not a user of this board (only logged)
                options = _enums.noteOptions.NONE;
            }
            break;
        case _enums.boardPrivacies.INTERNAL_ALTERABLE:
            if(user) { // user is a user of this board
                options = calculateNoteOptions(user, note);
            } else { // user is not a user of this board (only logged)
                // note keep its default options
                options = note.defaultOptions;
            }
            break;
        case _enums.boardPrivacies.PRIVATE:
            if(user) { // user is a user of this board
                options = calculateNoteOptions(user, note);
            } else { // user is not a user of this board (only logged)
                // note keep its default options
                options = note.defaultOptions;
            }
            break;
        default:
            // TODO : throw exception ?
            options = _enums.noteOptions.NONE;
            break;
    }
    return options;
}

// calculate note option for a user
var calculateNoteOptions = function(user, note) {
    var options = 0;
    switch (user.userGroup) {
        case _enums.userGroups.OWNER:
            options = note.ownerOptions;
            break;
        case _enums.userGroups.ADMIN:
            options = note.adminOptions;
            break;
        case _enums.userGroups.CONTRIBUTOR:
            options = note.contributorOptions;
            break;
        case _enums.userGroups.VIEWER:
            options = _enums.noteOptions.NONE;
            break;
        default:
            // TODO : throw exception ?
            options = _enums.noteOptions.NONE;
            break;
    }
    if(note.lock && note.lock <= user.userGroup) {// note is locked by a user with a higher or same profile (from 1 to 4, with 1 the highest) than the current user
        options = _enums.noteOptions.NONE;
    }
    return options;
}

var onPostNotes = function (context, callback) {
    var note = context.content;
    var fun;
    switch (note.update) {
        case _enums.noteUpdateType.ADD: fun = _data.addNote; break;
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
                    // caching note to have its options according profile
                    /*
                    boardCache.addNote(note.boardId, note);
                    */
                    boardVersioning.update(note);
                    callback(null, {code: 200, message: {id: note.id}});
                }
            });
        cnx.end();
    }
};

var onDeleteNotes = function (context, callback) {
    var noteId = parseInt(context.path.query.noteId);
    var boardId = parseInt(context.path.query.boardId);
    var note = {boardId: boardId, id: noteId};
    var cnx = _data.getMySqlConnection();
    cnx.connect();
    _data.deleteNote(cnx, note,
        function(error, result) {
            if (error) {
                callback(error);
            } else {
                note.update = _enums.noteUpdateType.REMOVE;
                // removing note from the board cache
                /*
                boardCache.removeNote(boardId, noteId);
                */
                boardVersioning.update(note);
                callback(null, {code: 200});
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
    logger.info("onBoardsPoll updates.length : " + updates.length); 
    if (updates.length) {
        callback(null, {code: 200, message: updates});
    } else {
        var userId = getCurrentUserId(context.cookies);
        var client = {
            userId: userId,
            callback: callback
        };
        boardVersioning.getCache(boardId).clients.push(client);
        // TODO
        /*context.request.addListener('close', function ()
        {
        });*/
    }
};

var boardCache = {    
    cache: {},
    
    get: function (boardId) {
        if (!(boardId in boardCache.cache)) {
            // TODO
            logger.error("Missing cache for board " + boardId);
        }
        return boardCache.cache[boardId];
    },
    
    add: function (board) {
        logger.info("Caching board " + board.id);
        boardCache.cache[board.id] = board;
    },
    
    getNote: function(boardId, noteId) {
        board = boardCache.get(boardId);
        for(var iNote in board.notes) {
            if(board.notes[iNote].id == noteId)
                return board.notes[iNote];
        }
        return null;
    },
    
    addNote: function(boardId, note) {
        logger.info("Adding note " + note.id + " to the cached board " + boardId);
        var board = boardCache.get(note.boardId);
        if(!board.notes) {
            board.notes = [];
        }
        board.notes.push(note);
    },
    
    removeNote: function(boardId, noteId) {
        logger.info("Removing note " + noteId + " from the cached board " + boardId);
        var board = boardCache.get(boardId);
        var index = -1;
        for(var iNote in board.notes) {
            if(board.notes[iNote].id == noteId) {
                index = iNote;
                break;
            }
        }
        board.notes.splice(index, 1);
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
        var cache = boardVersioning.getCache(note.boardId);
        cache.version++;
        var update = {
            version: cache.version,
            note: note
        };
        if (cache.updates.length === boardVersioning.queueSize) {
            cache.updates.shift();
        }
        cache.updates.push(update);
        /*
        var cachedNote = boardCache.getNote(note.boardId, note.id);
        var board = boardCache.get(note.boardId);
        */
        var updates = [update];
        for (var i = 0, imax = cache.clients.length; i < imax; i++) {
            // setting note options according to user (i.e. client) profile for the current board
            /*
            if(cachedNote) { // cached note must contain the different options according to profile 
                update.note.options = calculateBoardNoteOptions(board, cache.clients[i].userId, cachedNote);
            } else {
                logger.error('note ' + note.id + ' not found in the cache for board ' + board.id);
            }
            */
            cache.clients[i].callback(null, {code: 200, message: updates});
        }
        cache.clients.length = 0;
    },

    getUpdates: function (boardId, version) {
        var list = [];
        var cache = boardVersioning.getCache(boardId);
        var board = boardCache.get(boardId);
        var userId = getCurrentUserId(context.cookies);
        if (cache.version > version) {
            for (var i = cache.updates.length - 1; i >= 0; i--) {
                if (cache.updates[i].version > version) {
                    // setting note options according to user (i.e. client) profile for the current board
                    /*
                    var note = cache.updates[i].note;
                    var cachedNote = boardCache.getNote(boardId, note.id);
                    if(cachedNote) { // cached note must contain the different options according to profile 
                        note.options = calculateBoardNoteOptions(board, userId, cachedNote);
                        logger.info("options for updated note " + note.id + " : " + note.options);
                    } else {
                        logger.error('note ' + note.id + ' not found in the cache for board ' + boardId);
                    }
                    */
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

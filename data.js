var _mysql = require('mysql');
var _server = require('./server.js');

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
    var cs = parseConnectionString(_server.settings.connectionString);
    return _mysql.createConnection({
        host: cs["Data Source"],
        user: cs["User Id"],
        password: cs["Password"],
        database: cs["Database"]
    });
};
exports.getMySqlConnection = getMySqlConnection;

var getUserById = function (cnx, id, callback) {
    cnx.query('SELECT id, email, name FROM user WHERE id = ?;',
            [id],
        function(error, rows, fields) {
            if (error) {
                callback({text: 'sql error', inner: error});
            } else {
                callback(null, rows.length > 0 ? rows[0] : null);
            }
        });
};
exports.getUserById = getUserById;

var getUserByNameAndPassword = function (cnx, name, password, callback) {
    cnx.query('SELECT id, email, name FROM user WHERE name = ? AND password = MD5(?);',
            [name, password],
        function(error, rows, fields) {
            if (error) {
                callback({text: 'sql error', inner: error});
            } else {
                callback(null, rows.length > 0 ? rows[0] : null);
            }
        });
};
exports.getUserByNameAndPassword = getUserByNameAndPassword;

var updateUserLoginDate = function (cnx, userId, callback) {
    cnx.query('UPDATE user SET last_seen_date = NOW() WHERE id = ?;',
            [userId],
        function(error, result) {
            if (error) {
                callback({text: 'sql error', inner: error});
            } else {
                callback();
            }
        });
};
exports.updateUserLoginDate = updateUserLoginDate;

var listBoardsByUserId = function (cnx, userId, callback) {
    cnx.query('SELECT b.id, b.name FROM board AS b JOIN board_user AS bu ON bu.board_id = b.id AND bu.user_id = ?;',
            [userId],
        function(error, rows, fields) {
            if (error) {
                callback({text: 'sql error', inner: error});
            } else {
                callback(null, rows);
            }
        });
};
exports.listBoardsByUserId = listBoardsByUserId;

var saveUser = function (cnx, user, callback) {
    cnx.query('INSERT INTO user (email, name, password, last_seen_date, creation_date, edition_date) VALUES (?, ?, MD5(?), NOW(), NOW(), NOW());',
            [user.email, user.name, user.password],
        function(error, result) {
            if (error) {
                callback({text: 'sql error', inner: error});
            } else {
                callback(null, result.insertId);
            }
        });
};
exports.saveUser = saveUser;

var saveNote = function (cnx, note, callback) {
    _server.logger.info('saving note ' + note.id);
    if (!note.id) {
        _server.logger.info('insert');
        cnx.query('INSERT INTO note (board_id, text, x, y, color, creation_date, edition_date) VALUES (?, ?, ?, ?, ?, NOW(), NOW());',
            [note.boardId, note.text, note.x, note.y, note.color],
            function(error, result) {
                _server.logger.info(JSON.stringify(result));
                if (error) {
                    callback({text: 'sql error', inner: error});
                } else {
                    callback(null, result.insertId);
                }
            });
    } else {
        _server.logger.info('update');
        cnx.query('UPDATE note SET text = ?, x = ?, y = ?, color = ?, edition_date = NOW() WHERE id = ?;',
            [note.text, note.x, note.y, note.color, note.id],
            function(error, result) {
                _server.logger.info(JSON.stringify(result));
                if (error) {
                    callback({text: 'sql error', inner: error});
                } else {
                    callback(null, note.id);
                }
            });
    }
};
exports.saveNote = saveNote;

var addBoard = function (cnx, board, callback) {
    cnx.query(
        'INSERT INTO board (name, creation_date, edition_date) ' +
        'VALUES (?, NOW(), NOW());',
        [board.name],
        function(error, result) {
            _server.logger.info(JSON.stringify(result));
            if (error) {
                callback({text: 'sql error', inner: error});
            } else {
                callback(null, result.insertId);
            }
        });
};
exports.addBoard = addBoard;

var linkBoardAndUser = function (cnx, userId, boardId, callback) {
    cnx.query(
        'INSERT INTO board_user (board_id, user_id, creation_date) ' +
        'VALUES (?, ?, NOW());',
        [boardId, userId],
        function(error, result) {
            if (error) {
                callback({text: 'sql error', inner: error});
            } else {
                callback();
            }
        });
};
exports.linkBoardAndUser = linkBoardAndUser;

var editBoard = function (cnx, userId, board, callback) {
    cnx.query(
            'UPDATE board AS b ' +
            'JOIN board_user AS bu ' +
            '  ON bu.board_id = b.id ' +
            '    AND bu.user_id = ? ' +
            'SET ' +
            '  b.name = ?, ' +
            '  edition_date = NOW() ' +
            'WHERE id = ?;',
            [userId, board.name, board.id],
        function(error, result) {
            _server.logger.info(JSON.stringify(result));
            if (error) {
                callback({text: 'sql error', inner: error});
            } else {
                callback();
            }
        });
};
exports.editBoard = editBoard;

var listNotesByBoardId = function (cnx, boardId, callback) {
    cnx.query('SELECT id, board_id AS boardId, text, x, y, color FROM note WHERE board_id = ?;',
            [boardId],
        function(error, rows, fields) {
            if (error) {
                callback({text: 'sql error', inner: error});
            } else {
                callback(null, rows);
            }
        });
};

exports.listNotesByBoardId = listNotesByBoardId;

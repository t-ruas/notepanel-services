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

var listBoardsUsersByBoardId = function (cnx, boardId, callback) {
    cnx.query('SELECT u.id, u.name, bu.user_group as userGroup FROM user AS u JOIN board_user AS bu ON bu.board_id = ? AND bu.user_id = u.id;',
            [boardId],
        function(error, rows, fields) {
            if (error) {
                callback({text: 'sql error', inner: error});
            } else {
                callback(null, rows);
            }
        });
};
exports.listBoardsUsersByBoardId = listBoardsUsersByBoardId;

var getBoard = function (cnx, boardId, callback) {
    cnx.query('SELECT b.id, b.name, b.width, b.height, b.color, b.privacy, b.options FROM board AS b WHERE b.id = ?',
            [boardId],
        function(error, rows, fields) {
            if (error) {
                callback({text: 'sql error', inner: error});
            } else {
                callback(null, rows);
            }
        });
};
exports.getBoard = getBoard;

var getBoardWithUsersWithNotes = function (cnx, boardId, callback) {
    var board = null;
    // retrieve board data
    getBoard(cnx, boardId, function (error, result) {
        if(error) {
            callback({text: 'Error retrieving board data', inner: error});
        } else {
            board = result[0];
            // retrieve board users data
            listBoardsUsersByBoardId(cnx, boardId, function(error, result) {
                if(error) {
                    callback({text: 'Error retrieving board users data', inner: error});
                } else {
                    board.users = result;
                    // retrieve board notes data
                    listNotesByBoardId(cnx, boardId, function(error, result) {
                        if(error) {
                            callback({text: 'Error retrieving board notes data', inner: error});
                        } else {
                            board.notes = result;
                            callback(null, board);
                        }
                    });
                }
            });
        }
    });
}
exports.getBoardWithUsersWithNotes = getBoardWithUsersWithNotes;

var saveUser = function (cnx, user, callback) {
    cnx.query('INSERT INTO user (email, name, password, last_seen_date, creation_date, edition_date) VALUES (?, ?, MD5(?), NOW(), NOW(), NOW());',
            [user.email, user.name, user.password],
        function (error, result) {
            if (error) {
                callback({text: 'sql error', inner: error});
            } else {
                callback(null, result.insertId);
            }
        });
};
exports.saveUser = saveUser;

var deleteNote = function (cnx, note, callback) {
    cnx.query('DELETE FROM note WHERE board_id = ? AND id = ?;',
            [note.boardId, note.id],
        function (error, result) {
            if (error) {
                callback({text: 'sql error', inner: error});
            } else {
                callback();
            }
        });
};
exports.deleteNote = deleteNote;

var addNote = function (cnx, note, callback) {
    _server.logger.info('insert note');
    cnx.query('INSERT INTO note (board_id, user_id, value, width, height, x, y, z, template, default_options, owner_options, admin_options, contributor_options, creation_date, edition_date) ' +
              'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW());',
        [note.boardId, note.userId, JSON.stringify(note.value), note.width, note.height, note.x, note.y, note.z, note.template, note.defaultOptions, note.ownerOptions, note.adminOptions, note.contributorOptions],
        function (error, result) {
            if (error) {
                callback({text: 'sql error', inner: error});
            } else {
                note.id = result.insertId;
                callback();
            }
        });
};
exports.addNote = addNote;

var updateNotePosition = function (cnx, note, callback) {
    _server.logger.info('saving note ' + note.id);
    cnx.query('UPDATE note SET x = ?, y = ?, z = ?, width = ?, height = ?, edition_date = NOW() WHERE id = ?;',
        [note.x, note.y, note.z, note.width, note.height, note.id],
        function(error, result) {
            _server.logger.info(JSON.stringify(result));
            if (error) {
                callback({text: 'sql error', inner: error});
            } else {
                callback();
            }
        });
};
exports.updateNotePosition = updateNotePosition;

var updateNoteValue = function (cnx, note, callback) {
    _server.logger.info('saving note ' + note.id);
    cnx.query('UPDATE note SET value = ?, edition_date = NOW() WHERE id = ?;',
        [JSON.stringify(note.value), note.id],
        function(error, result) {
            _server.logger.info(JSON.stringify(result));
            if (error) {
                callback({text: 'sql error', inner: error});
            } else {
                callback();
            }
        });
};
exports.updateNoteValue = updateNoteValue;

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
    cnx.query('SELECT id, board_id AS boardId, user_id as userId, value, width, height, x, y, z, template, default_options as defaultOptions, owner_options as ownerOptions, admin_options as adminOptions, contributor_options as contributorOptions FROM note WHERE board_id = ?;',
            [boardId],
        function(error, rows, fields) {
            if (error) {
                callback({text: 'sql error', inner: error});
            } else {
                for (var i = 0, imax = rows.length; i < imax; i++) {
                    rows[i].value = JSON.parse(rows[i].value);
                }
                callback(null, rows);
            }
        });
};
exports.listNotesByBoardId = listNotesByBoardId;

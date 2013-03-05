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

var deleteNote = function (cnx, boardId, noteId, callback) {
    cnx.query('DELETE FROM note WHERE board_id = ? AND id = ?;',
            [boardId, noteId],
        function (error, result) {
            if (error) {
                callback({text: 'sql error', inner: error});
            } else {
                callback();
            }
        });
};
exports.deleteNote = deleteNote;

var addNote = function (cnx, boardId, note, callback) {
    _server.logger.info('insert note');
    cnx.query('INSERT INTO note (board_id, user_id, value, width, height, x, y, z, template, default_options, owner_options, admin_options, contributor_options, creation_date, edition_date) ' +
              'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW());',
        [boardId, note.userId, JSON.stringify(note.value), note.width, note.height, note.x, note.y, note.z, note.template, note.defaultOptions, note.ownerOptions, note.adminOptions, note.contributorOptions],
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

var listNotesByBoardId = function (cnx, boardId, callback) {
    cnx.query('SELECT id, user_id as userId, value, width, height, x, y, z, template, default_options as defaultOptions, owner_options as ownerOptions, admin_options as adminOptions, contributor_options as contributorOptions FROM note WHERE board_id = ?;',
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

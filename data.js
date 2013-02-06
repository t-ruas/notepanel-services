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

var saveNote = function (cnx, note, callback) {
    console.log('saving note [%s]', note.id);
    if (!note.id) {
        console.log('insert');
        cnx.query('INSERT INTO note (board_id, text, x, y, color, creation_date, edition_date) VALUES (?, ?, ?, ?, ?, NOW(), NOW());',
                [note.boardId, note.text, note.x, note.y, note.color],
            function(error, result) {
                console.dir(result);
                if (error) {
                    callback({text: 'sql error', inner: error});
                } else {
                    callback(null, result.insertId);
                }
            });
    } else {
        console.log('update');
        cnx.query('UPDATE note SET text = ?, x = ?, y = ?, color = ?, edition_date = NOW() WHERE id = ?;',
                [note.text, note.x, note.y, note.color, note.id],
            function(error, result) {
                console.dir(result);
                if (error) {
                    callback({text: 'sql error', inner: error});
                } else {
                    callback(null, note.id);
                }
            });
    }
};

exports.getMySqlConnection = getMySqlConnection;
exports.getUserById = getUserById;
exports.getUserByNameAndPassword = getUserByNameAndPassword;
exports.listBoardsByUserId = listBoardsByUserId;
exports.saveNote = saveNote;

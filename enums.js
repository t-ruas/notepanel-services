// User groups
var userGroups = {
    OWNER : 1,
    ADMIN : 2,
    CONTRIBUTOR : 3,
    VIEWER : 4,
};
exports.userGroups = userGroups;

// Note option
var noteOptions = {
    NONE : 0,
    REMOVABLE : 1,
    MOVABLE : 2,
    RESISZEABLE : 4,
    EDITABLE : 8,
    COLORABLE : 16,
    // TODO : ALL : REMOVABLE | MOVABLE | RESISZEABLE | EDITABLE | COLORABLE
    //ALL : this.REMOVABLE | this.MOVABLE | this.RESISZEABLE | this.COLORABLE
    ALL : (1 | 2 | 4 | 8 | 16)
};
exports.noteOptions = noteOptions;

var boardPrivacies = {
    PRIVATE : 1, // only invited users are allowed to see it and edit it according to their profile on the board
    INTERNAL_READONLY : 2, // all registerd users are allowed to view it
    INTERNAL_ALTERABLE : 3, // all registerd users are allowed to edit it
    PUBLIC : 4 // all users (even not registered one's) are allowed to view it
};
exports.boardPrivacies = boardPrivacies;

var path = require('path'),
    Level = require('../lib/levels/level'),
    LevelPlain = require('../lib/levels/level-plain'),
    levelScanner = require('../lib/levels/level-scanner'),

    fixturesDirname = path.resolve(__dirname, 'fixtures'),
    nestedLevelDirname = path.join(fixturesDirname, 'nested-level'),
    simpleLevelDirname = path.join(fixturesDirname, 'simple-level');

suite('scan level', function () {
    set('iterations', 10000);
    set('type', 'static');

    bench('nested level', function (done) {
        var level = new Level(nestedLevelDirname);

        level.load()
            .then(done, done);
    });

    bench('simple level', function (done) {
        var level = new Level(simpleLevelDirname, LevelPlain);

        level.load()
            .then(done, done);
    });

    bench('nested level', function (done) {
        levelScanner.scan(nestedLevelDirname, done);
    });

//    bench('simple level', function (done) {
//        levelScanner.scan(simpleLevelDirname, done);
//    });
});

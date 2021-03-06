/**
 * levels
 * ======
 *
 * Собирает информацию об уровнях переопределения проекта, предоставляет `?.levels`. Результат выполнения этой
 * технологии необходим технологиям `enb/techs/deps`, `enb/techs/deps-old` и `enb/techs/files`.
 *
 * **Опции**
 *
 * * *String* **target** — Результирующий таргет. По умолчанию — `?.levels`.
 * * *(String|Object)[]* **levels** — Уровни переопределения. Полные пути к папкам с уровнями переопределения.
 *   Вместо строки с путем к уровню может использоваться объект вида
 *   `{ path: '/home/user/www/proj/lego/blocks-desktop', check: false }` для того,
 *   чтобы закэшировать содержимое тех уровней переопределения, которые не модифицируются в рамках проекта.
 *
 * **Пример**
 *
 * ```javascript
 * nodeConfig.addTech([require('enb-bem-techs/techs/levels'), {
 *     levels: [
 *         { path: 'lego/blocks-desktop', check: false },
 *         'desktop.blocks'
 *     ].map(function (level) {
 *         return config.resolvePath(level);
 *     })
 * }]);
 * ```
 */
var path = require('path'),
    inherit = require('inherit'),
    vow = require('vow'),
    vfs = require('enb/lib/fs/async-fs'),
    Level = require('../lib/levels/level'),
    Levels = require('../lib/levels/levels');

module.exports = inherit(require('enb/lib/tech/base-tech'), {
    getName: function () {
        return 'levels';
    },

    init: function () {
        this.__base.apply(this, arguments);
        this._levelConfig = this.getRequiredOption('levels');
        this._sublevelDirectories = this.getOption('sublevelDirectories', ['blocks']);
        this._target = this.node.unmaskTargetName(this.getOption('target', '?.levels'));
    },

    getTargets: function () {
        return [this._target];
    },

    build: function () {
        var _this = this,
            root = this.node.getRootDir(),
            target = this._target,
            levelList = [],
            levelsToCache = [],
            levelsIndex = {},
            cache = this.node.getNodeCache(target),
            levelConfig = _this._levelConfig;

        for (var i = 0, l = levelConfig.length; i < l; i++) {
            var levelInfo = levelConfig[i];

            levelInfo = typeof levelInfo === 'object' ? levelInfo : { path: levelInfo };

            var levelPath = path.resolve(root, levelInfo.path),
                levelKey = 'level:' + levelPath;
            if (levelsIndex[levelPath]) {
                continue;
            }
            levelsIndex[levelPath] = true;
            if (!this.node.buildState[levelKey]) {
                var level = new Level(levelPath, this.node.getLevelNamingScheme(levelPath));
                if (levelInfo.check === false) {
                    var blocks = cache.get(levelPath);
                    if (blocks) {
                        level.loadFromCache(blocks);
                    } else {
                        levelsToCache.push(level);
                    }
                }
                this.node.buildState[levelKey] = level;
            }
            levelList.push(this.node.buildState[levelKey]);
        }

        return vfs.listDir(path.join(_this.node.getRootDir(), _this.node.getPath()))
            .then(function (listDir) {
                return _this._sublevelDirectories.filter(function (path) {
                    return listDir.indexOf(path) !== -1;
                });
            })
            .then(function (sublevels) {
                return vow.all(sublevels.map(function (path) {
                    var sublevelPath = _this.node.resolvePath(path);
                    if (!levelsIndex[sublevelPath]) {
                        levelsIndex[sublevelPath] = true;
                        levelList.push(new Level(sublevelPath, _this.node.getLevelNamingScheme(sublevelPath)));
                    }
                }));
            })
            .then(function () {
                return vow.all(levelList.map(function (level) {
                        return level.load();
                    }))
                    .then(function () {
                        levelsToCache.forEach(function (level) {
                            cache.set(level.getPath(), level.getBlocks());
                        });
                        _this.node.resolveTarget(target, new Levels(levelList));
                    });
            });
    },

    clean: function () {}
});

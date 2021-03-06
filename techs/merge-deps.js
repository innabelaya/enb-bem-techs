/**
 * merge-deps
 * ==========
 *
 * Формирует *deps* с помощью объединения других deps-файлов.
 *
 * **Опции**
 *
 * * *String[]* **sources** — Исходные deps-таргеты. Обязательная опция.
 * * *String* **target** — Результирующий deps-таргет. По умолчанию — `?.deps.js`.
 *
 * **Пример**
 *
 * ```javascript
 * nodeConfig.addTech([require('enb-bem-techs/techs/merge-deps'), {
 *     sources: ['search.deps.js', 'router.deps.js'],
 *     target: 'all.deps.js'
 * }]);
 * ```
 */
var inherit = require('inherit'),
    vow = require('vow'),
    vfs = require('enb/lib/fs/async-fs'),
    asyncRequire = require('enb/lib/fs/async-require'),
    dropRequireCache = require('enb/lib/fs/drop-require-cache'),
    deps = require('../lib/deps/deps');

module.exports = inherit(require('enb/lib/tech/base-tech'), {
    getName: function () {
        return 'merge-deps';
    },

    configure: function () {
        var _this = this,
            logger = this.node.getLogger();

        this._target = this.getOption('depsTarget');
        if (this._target) {
            logger.logOptionIsDeprecated(this.node.unmaskTargetName(this._target), 'enb-bem', this.getName(),
                'depsTarget', 'target');
        } else {
            this._target = this.getOption('target', this.node.getTargetName('deps.js'));
        }
        this._target = this.node.unmaskTargetName(this._target);

        this._sources = this.getOption('depsSources');
        if (this._sources) {
            logger.logOptionIsDeprecated(this._target, 'enb-bem', this.getName(), 'depsSources', 'sources');
        } else {
            this._sources = this.getRequiredOption('sources');
        }
        this._sources = this._sources.map(function (source) {
            return _this.node.unmaskTargetName(source);
        });
    },

    getTargets: function () {
        return [this._target];
    },

    build: function () {
        var _this = this,
            node = this.node,
            target = this._target,
            sources = this._sources,
            cache = node.getNodeCache(target),
            targetFilename = node.resolvePath(target),
            sourceFilenames = sources.map(function (sourceTarget) {
                return node.resolvePath(sourceTarget);
            });

        return this.node.requireSources(sources)
            .then(function (sourceDeps) {
                if (cache.needRebuildFile('deps-file', targetFilename) ||
                    cache.needRebuildFileList('source-file-list', sourceFilenames)
                ) {
                    return vow.all(sourceDeps.map(function (source, i) {
                            if (source) { return source.deps; }

                            var filename = sourceFilenames[i];

                            dropRequireCache(require, filename);
                            return asyncRequire(filename)
                                .then(function (res) {
                                    return res.deps;
                                });
                        }))
                        .then(function (sourceDeps) {
                            var mergedDeps = deps.merge(sourceDeps),
                                str = 'exports.deps = ' + JSON.stringify(mergedDeps, null, 4) + ';';

                            return vfs.write(targetFilename, str, 'utf-8')
                                .then(function () {
                                    cache.cacheFileInfo('deps-file', targetFilename);
                                    cache.cacheFileList('source-file-list', sourceFilenames);
                                    _this.node.resolveTarget(target, { deps: mergedDeps });
                                });
                        });
                } else {
                    node.isValidTarget(target);
                    dropRequireCache(require, targetFilename);

                    return asyncRequire(targetFilename)
                        .then(function (result) {
                            node.resolveTarget(target, result);
                            return null;
                        });
                }
            });
    }
});

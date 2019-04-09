const path = require('path');
const loaderUtils = require('loader-utils');
const postcss = require('postcss');

const localByDefault = require('postcss-modules-local-by-default');
const modulesScope = require('postcss-modules-scope');

const postCssPlugins = require('./postcss-plugins');
const extractThemeRulesPlugin = postCssPlugins.extractThemeRulesPlugin;
const removeCssModuleExports = postCssPlugins.removeCssModuleExports;

// copied from css-loader/src/utils.js
function getLocalIdent(loaderContext, localIdentName, localName, options) {
    if (!options.context) {
      // eslint-disable-next-line no-param-reassign
      options.context = loaderContext.rootContext;
    }

    const request = normalizePath(
      path.relative(options.context || '', loaderContext.resourcePath)
    );

    // eslint-disable-next-line no-param-reassign
    options.content = `${options.hashPrefix + request}+${unescape(localName)}`;

    // eslint-disable-next-line no-param-reassign
    localIdentName = localIdentName.replace(/\[local\]/gi, localName);

    const hash = loaderUtils.interpolateName(
      loaderContext,
      localIdentName,
      options
    );

    return hash
      .replace(new RegExp('[^a-zA-Z0-9\\-_\u00A0-\uFFFF]', 'g'), '-')
      .replace(/^((-?[0-9])|--)/, '_$1');
  }


module.exports = function (source, map) {
    if ( this.cacheable ) this.cacheable();

    var loader = this;
    var file   = loader.resourcePath;

    var callback = loader.async();

    var plugins = [extractThemeRulesPlugin];

    Promise.resolve().then(function (config) {
        return postcss(plugins).process(source).then(function (result) {
            result.warnings().forEach(function (msg) {
                loader.emitWarning(msg.toString());
            });

            if (result.themeRoot) {
                const content = result.themeRoot.toString();

                return {
                    css: result.css,
                    map: result.map ? result.map.toJSON() : null,
                    themeCss: content
                };
            }

            // pass through unaffected css
            callback(null, source, map);
            return null;
        });
    }).then(function (prevResult) {
        // no theme css processing needed
        if (!prevResult) { return; }

        const content = prevResult.themeCss;

        const options = loaderUtils.getOptions(loader) || {};
        const moduleMode = options.modules;
        const localIdentName = options.localIdentName || '[hash:base64]';
        const customGetLocalIdent = options.getLocalIdent || getLocalIdent;

        // convert local classnames for css modules
        return postcss([
            localByDefault({
                mode: moduleMode ? 'local' : 'global'
            }),
            modulesScope({
                generateScopedName: function generateScopedName (exportName) {
                    return customGetLocalIdent(loader, localIdentName, exportName, {
                        regExp: options.localIdentRegExp,
                        hashPrefix: options.hashPrefix || '',
                        context: loader.options.context
                    });
                }
            }),
            removeCssModuleExports
        ]).process(content).then(function (result) {
            result.warnings().forEach(function (msg) {
                loader.emitWarning(msg.toString());
            });

            if ('_emitThemePartial' in loader) {
                loader._emitThemePartial(loader.resourcePath, result.css);
            } else {
                throw new Error('Theme loader missing _emitThemePartial function. Did you forget to include the ThemePlugin?');
            }

            callback(null, prevResult.css, prevResult.map);
            return null;
        });
    }).catch(function (error) {
        callback(error);
    });
};

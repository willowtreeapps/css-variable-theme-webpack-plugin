const path = require('path');
const loaderUtils = require('loader-utils');
const postcss = require('postcss');

const localByDefault = require('postcss-modules-local-by-default');
const modulesScope = require('postcss-modules-scope');

const postCssPlugins = require('./postcss-plugins');
const extractThemeRulesPlugin = postCssPlugins.extractThemeRulesPlugin;
const removeCssModuleExports = postCssPlugins.removeCssModuleExports;

const stringifyRuleMap = (ruleMap) => {
    return Object.keys(ruleMap).reduce((acc, selector) => {
        const declsMap = ruleMap[selector];
        const decls = Object.keys(declsMap).map(prop => `${prop}: ${declsMap[prop]};`);

        return `${selector} {\n\t${decls.join('\n\t')}\n}`;
    }, '');
};

// copied from css-loader/lib/getLocalIdent.js
function getLocalIdent(loaderContext, localIdentName, localName, options) {
	if(!options.context)
		options.context = loaderContext.options && typeof loaderContext.options.context === "string" ? loaderContext.options.context : loaderContext.context;
	var request = path.relative(options.context, loaderContext.resourcePath);
	options.content = options.hashPrefix + request + "+" + localName;
	localIdentName = localIdentName.replace(/\[local\]/gi, localName);
	var hash = loaderUtils.interpolateName(loaderContext, localIdentName, options);
	return hash.replace(new RegExp("[^a-zA-Z0-9\\-_\u00A0-\uFFFF]", "g"), "-").replace(/^([^a-zA-Z_])/, "_$1");
};


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

            if (result.ruleMap) {
                const content = stringifyRuleMap(result.ruleMap);

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
        const content = prevResult.themeCss;

        const options = loaderUtils.getOptions(loader) || {};
        const localIdentName = options.localIdentName || '[hash:base64]';
        const customGetLocalIdent = options.getLocalIdent || getLocalIdent;

        // convert local classnames for css modules
        return postcss([
            localByDefault({
                mode: 'local'
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
                loader._emitThemePartial(result.css);
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

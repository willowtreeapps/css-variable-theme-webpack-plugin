const fs = require('fs');
const postcss = require('postcss');
const loaderUtils = require('loader-utils');

const postCssPlugins = require('./postcss-plugins');
const extractVariablesPlugin = postCssPlugins.extractVariablesPlugin;
const replaceThemeVars = postCssPlugins.replaceThemeVars;

const parseThemeFile = (source) => {
    return postcss([extractVariablesPlugin]).process(source).then(result => {
        result.warnings().forEach(function (msg) {
            console.warn(msg.toString());
        });

        return result.variables;
    });
};

const readThemeFile = (filename) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, (err, data) => {
            if (err) {
                reject(err);
                return;
            }

            parseThemeFile(data)
                .then(resolve)
                .catch(reject);
        });
    });
};

const generateTheme = (name, source, variables) => {
    return postcss([
        replaceThemeVars({variables})
    ]).process(source).then(result => {
        result.warnings().forEach(function (msg) {
            console.warn(msg.toString());
        });

        return {
            name: name,
            source: result.css
        };
    });
};

const generateThemes = (themes, source) => {
    let promises = [];

    for (const themeName in themes) {
        if (!themes.hasOwnProperty(themeName)) continue;

        const themeFile = themes[themeName];
        const promise = readThemeFile(themeFile)
            .then(themeVars => generateTheme(themeName, source, themeVars));

        promises.push(promise);
    }

    return Promise.all(promises);
};

function ThemePlugin(options) {
    this.options = options || {};
    this.cache = null;
}

ThemePlugin.prototype.apply = function apply(compiler) {
    const themes = this.options.themes;
    const themePartials = {};

    compiler.plugin('compilation', compilation => {
        compilation.plugin('normal-module-loader', (context, module) => {
            context._emitThemePartial = (resourcePath, themeSource) => {
                themePartials[resourcePath] = themeSource;
            };
        });
    });

    compiler.plugin('emit', (compilation, done) => {
        const themePartialResources = Object.keys(themePartials);

        if (themePartialResources.length === 0) {
            done();
            return;
        }

        // Concat theme partials
        const source = themePartialResources
            .map(resourcePath => themePartials[resourcePath])
            .join('\n');

        generateThemes(themes, source).then(function (results) {
            const themeAssets = results.reduce((acc, theme) => {
                // loaderUtils.interpolateName(loader, 'theme.[name].css', { content: loader.options.context });
                const filename = `${theme.name}.theme.css`;

                acc[filename] = {
                    source: () => theme.source,
                    size: () => theme.source.length
                };

                return acc;
            }, {});

            Object.assign(compilation.assets, themeAssets);

            done();
        }).catch(function (error) {
            console.error(error);
            done();
        });
    });
};

module.exports = ThemePlugin;

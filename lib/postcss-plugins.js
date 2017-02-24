const postcss = require('postcss');

const THEME_VAR_PREFIX = 'theme-var';

module.exports.extractThemeRulesPlugin = postcss.plugin('postcss-extract-theme-rules', (options = {}) => {
    const prefix = options.prefix || THEME_VAR_PREFIX;

    return (root, results) => {
        let ruleMap;

        root.walkRules(rule => {
            rule.walkDecls(decl => {
                if (decl.value.indexOf(prefix) > -1) {
                    ruleMap = ruleMap || (ruleMap = {});
                    let declMap = ruleMap[rule.selector] || (ruleMap[rule.selector] = {});

                    declMap[decl.prop] = decl.value;
                    decl.remove();
                }
            });
        });

        results.ruleMap = ruleMap;
    };
});

module.exports.extractVariablesPlugin = postcss.plugin('postcss-extract-variables', () => {
    return (root, results) => {
        let vars = {};

        root.walkRules(rule => {
            if (rule.selector !== ':root') return;

            rule.walkDecls(decl => {
                if (decl.prop.indexOf('--') === 0) {
                    vars[decl.prop] = decl.value;
                }
            });
        });

        results.variables = vars;
    };
});

module.exports.replaceThemeVars = postcss.plugin('postcss-replace-theme-vars', (options = {}) => {
    const regex = new RegExp(THEME_VAR_PREFIX + '\\((.+?)\\)');
    const variables = options.variables;

    return (root) => {
        root.walkDecls(decl => {
            const match = regex.exec(decl.value);
            if (!match) return;

            const varName = match[1];

            if (!variables.hasOwnProperty(varName)) {
                console.error(`Missing theme-var '${varName}'`);
            }

            decl.value = variables[varName];
        });
    };
});

module.exports.removeCssModuleExports = postcss.plugin('postcss-remove-exports', () => {
    return (root) => {
        root.walkRules(rule => {
            if (rule.selector === ':export') {
                rule.remove();
            }
        });
    };
});

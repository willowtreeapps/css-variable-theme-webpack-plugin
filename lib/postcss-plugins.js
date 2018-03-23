const postcss = require('postcss');

const THEME_VAR_PREFIX = 'theme-var';
const VAR_REGEX = /var\((--.+?)\)/;
const VAR_NAME_REGEX = /var\((--.+?)\)/;

module.exports.extractThemeRulesPlugin = postcss.plugin('postcss-extract-theme-rules', (options = {}) => {
    const prefix = options.prefix || THEME_VAR_PREFIX;

    return (root, results) => {
        let themeRoot = new postcss.root();

        const extractThemeRule = rule => {
            let hasThemeVar = false
            let decls = [];
            rule.walkDecls(decl => {
                if (decl.value.indexOf(prefix) > -1) {
                    hasThemeVar = true
                    let themeDecl = decl.clone();
                    decls.push(themeDecl);
                    decl.remove();
                }
            });
            if (decls.length > 0) {
                let themeRule = new postcss.rule();
                themeRule.selector = rule.selector;
                themeRule.nodes = decls;
                themeRule.raws = rule.raws;
                return themeRule
            }
        }

        root.each(node => {
            let nodes = [];
            switch (node.type) {
                case 'rule':
                    let themeRule = extractThemeRule(node);
                    if (themeRule) {
                        nodes.push(themeRule);
                    }
                    break;
                case 'atrule':
                    let rules = []
                    node.each(atnode => {
                        if (atnode.type === 'rule') {
                            let themeRule = extractThemeRule(atnode);
                            if (themeRule) {
                                rules.push(themeRule);
                            }
                        }
                    })
                    if (rules.length > 0) {
                        let themeAtRule = new postcss.atRule()
                        themeAtRule.params = node.params;
                        themeAtRule.name = node.name;
                        themeAtRule.nodes = rules;
                        themeAtRule.raws = node.raws;
                        nodes.push(themeAtRule);
                    }
                    break;
            }
            if (nodes.length > 0) {
                themeRoot.nodes = themeRoot.nodes.concat(nodes);
            }
        });

        if (themeRoot.nodes.length > 0) {
            results.themeRoot = themeRoot
        }
    };
});

const flattenValue = (variables, name, recursiveSeenMap = {}) => {
    let value = variables[name];

    // Check for circular dependency
    if (recursiveSeenMap.hasOwnProperty(name)) {
        throw new Error(`Found circular dependency in CSS theme variables for '${name}'`);
    } else {
        recursiveSeenMap[name] = true;
    }

    // Replace recursive variables in left-to-right order
    while (value && value.indexOf('var(--') > -1) {
        const varName = VAR_NAME_REGEX.exec(value)[1];
        const varValue = flattenValue(variables, varName, recursiveSeenMap);

        // Overwrite value to prevent duplicate work
        variables[name] = value = value.replace(VAR_REGEX, varValue);
    }

    return value;
};

const flattenRecursiveValues = (variables) => {
    for (const key in variables) {
        flattenValue(variables, key);
    }

    return variables;
};

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

        results.variables = flattenRecursiveValues(vars);
    };
});

module.exports.replaceThemeVars = postcss.plugin('postcss-replace-theme-vars', (options = {}) => {
    const variables = options.variables;

    const varNameRegex = new RegExp(THEME_VAR_PREFIX + '\\((.+?)\\)');
    const varRegex = new RegExp(THEME_VAR_PREFIX + '\\(.+?\\)');

    return (root) => {
        root.walkDecls(decl => {
            // Replace all theme vars in decl value
            let match;
            while (match = varNameRegex.exec(decl.value)) {
                const varName = match[1];
                const varValue = variables[varName];

                if (varValue) {
                    decl.value = decl.value.replace(varRegex, varValue);
                } else {
                    console.error(`Missing theming variable '${varName}'`);
                    break;
                }
            }
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

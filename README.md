# CSS Variable Theme Webpack Plugin

## Install

```bash
npm install --save-dev css-variable-theme-webpack-plugin
```

## Usage

```js
/* webpack.config.js */
const path = require('path');
const ThemePlugin = require('css-variable-theme-webpack-plugin');

module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'css-loader',
          path.join(__dirname, './node_modules/css-variable-theme-webpack-plugin/loader')
        ]
      }
    ]
  },
  plugins: [
    new ThemePlugin({
      themes: {
        light: 'light.css',
        dark: 'dark.css'
      }
    }),
  ]
}
```

Theme files support CSS variable syntax on the `:root` selector.
```css
/* light.css */
:root {
    --color: black;
    --background-color: white;
}

/* dark.css */
:root {
    --color: white;
    --background-color: black;
}
```

Use variables from your theme files in your stylesheets.
```css
/* styles.css */
body {
    color: theme-var(--color);
    background-color: theme-var(--background-color);
}
```

### Usage with [CSS Modules](https://github.com/css-modules/css-modules)

Use loader options `modules` and `localIdentName` to generate locally scoped CSS class names. These work the same as [css-loader](https://github.com/webpack-contrib/css-loader#css-scope).
const webpack = require('webpack');
const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  transpileDependencies: [],
  configureWebpack: (config) => {
    // remove any ProgressPlugin added by plugins with bad options
    config.plugins = (config.plugins || []).filter(p => !(p instanceof webpack.ProgressPlugin));
    // optional: add a clean one with no options (valid for webpack 5)
    // config.plugins.push(new webpack.ProgressPlugin());
  },
  // If you previously had devServer.progress, remove it. For WDS v4 use:
  // devServer: { client: { progress: true } }
});


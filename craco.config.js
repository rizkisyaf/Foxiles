const webpack = require("webpack");

module.exports = function override(config) {
  // Ensure config.resolve exists
  config.resolve = config.resolve || {};
  const fallback = config.resolve.fallback || {};
  Object.assign(fallback, {
    crypto: false,
    stream: false,
    assert: false,
    http: false,
    https: false,
    os: false,
    url: false,
    zlib: false,
  });
  config.resolve.fallback = fallback;


  config.plugins = (config.plugins || []).concat([
     new webpack.ProvidePlugin({
       process: "process/browser", // Polyfill process
       Buffer: ["buffer", "Buffer"], // Polyfill Buffer
     }),
   ]);

  // Ensure config.module exists
  config.module = config.module || {};
  config.module.rules = config.module.rules || [];

  // Ignore specific source map warnings
  config.ignoreWarnings = [/Failed to parse source map/];

  // Add source-map-loader for JavaScript/JSX but exclude node_modules
  config.module.rules.push({
    test: /\.(js|mjs|jsx)$/,
    enforce: "pre",
    exclude: /node_modules/, // Exclude node_modules from source-map-loader
    loader: require.resolve("source-map-loader"),
    resolve: {
      fullySpecified: false,
    },
  });

  // Add CSS loader to handle .css files
  config.module.rules.push({
    test: /\.css$/i, // Match CSS files
    use: ['style-loader', 'css-loader'], // Use these loaders
  });

  return config;
};

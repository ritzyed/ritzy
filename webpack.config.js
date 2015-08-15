var _ = require('lodash')
var webpack = require('webpack')
var path = require('path')

module.exports = function(output, configs, debug, verbose, autoprefixer) {
  // define these as globals in all packed files
  var GLOBALS = {
    'process.env.NODE_ENV': debug ? '"development"' : '"production"',
    '__DEV__': debug
  }

  var AUTOPREFIXER_LOADER = 'autoprefixer-loader?{browsers:' + JSON.stringify(autoprefixer) + '}'

  //
  // Common configuration chunk to be used for all other bundles
  // -----------------------------------------------------------------------------

  var config = {
    output: {
      path: output,
      publicPath: '',
      sourcePrefix: '  '
    },

    cache: debug,
    debug: debug,
    devtool: debug ? '#inline-source-map' : false,

    stats: {
      colors: true,
      reasons: verbose
    },

    plugins: [
      new webpack.optimize.OccurenceOrderPlugin()
    ],

    resolve: {
      extensions: ['', '.webpack.js', '.web.js', '.js', '.jsx']
    },

    module: {
      preLoaders: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          loader: 'eslint-loader'
        }
      ],

      loaders: [
        {
          test: /\.css$/,
          loader: 'style-loader!css-loader!' + AUTOPREFIXER_LOADER
        },
        {
          test: /\.less$/,
          loader: 'style-loader!css-loader!' + AUTOPREFIXER_LOADER + '!less-loader'
        },
        {
          test: /\.gif/,
          loader: 'url-loader?limit=10000&mimetype=image/gif'
        },
        {
          test: /\.jpg/,
          loader: 'url-loader?limit=10000&mimetype=image/jpg'
        },
        {
          test: /\.png/,
          loader: 'url-loader?limit=10000&mimetype=image/png'
        },
        {
          test: /\.svg/,
          loader: 'url-loader?limit=10000&mimetype=image/svg+xml'
        },
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          loader: 'babel-loader'
        },
        {
          test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
          loader: 'url-loader?limit=10000&minetype=application/font-woff'
        },
        {
          test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
          loader: 'file-loader'
        }
      ]
    },

    eslint: {
      configFile: './.eslintrc',
      reporter: require('eslint/lib/formatters/stylish')
    }
  }

  //
  // Configuration for the client-side library bundle (ritzy.js) for release
  // -----------------------------------------------------------------------------

  var libraryConfig = _.merge({}, config, {
    entry: './src/ritzy.js',
    output: {
      filename: configs.libName,
      library: 'ritzy',
      libraryTarget: 'commonjs2'
    },
    plugins: config.plugins.concat([
      new webpack.DefinePlugin(_.merge(GLOBALS, {'__SERVER__': false})),
      new webpack.optimize.DedupePlugin()
    ].concat(!debug ? [
        new webpack.optimize.UglifyJsPlugin({
          compress: {
            screw_ie8: true,
            warnings: false
          }
        })
    ] : []))
  })

  //
  // Configuration for the client-side bundle (client.js) for testing
  // -----------------------------------------------------------------------------

  var clientConfig = _.merge({}, config, {
    entry: './src/client.js',
    output: {
      filename: 'client.js'
    },
    plugins: config.plugins.concat([
      new webpack.DefinePlugin(_.merge(GLOBALS, {'__SERVER__': false})),
      new webpack.optimize.DedupePlugin()
    ].concat(!debug ? [
      new webpack.optimize.UglifyJsPlugin({
        compress: {
          screw_ie8: true,
          warnings: false
        }
      })
    ] : []))
  })

  //
  // Configuration for the server-side bundle (server.js)
  // -----------------------------------------------------------------------------

  var serverConfig = _.merge({}, config, {
    entry: './src/server.js',
    output: {
      filename: 'server.js',
      libraryTarget: 'commonjs2'
    },
    target: 'node',
    externals: /^[a-z][a-z\.\-0-9]*$/,
    node: {
      console: false,
      global: false,
      process: false,
      Buffer: false,
      __filename: false,
      __dirname: false
    },
    plugins: config.plugins.concat(
      new webpack.DefinePlugin(_.merge(GLOBALS, {'__SERVER__': true}))
    ),
    module: {
      loaders: config.module.loaders.map(function(loader) {
        // Remove style-loader
        return _.merge(loader, {
          loader: loader.loader = loader.loader.replace('style-loader!', '')
        })
      })
    }
  })

  var activeConfigs = []
  if(configs.client) activeConfigs.push(clientConfig)
  if(configs.server) activeConfigs.push(serverConfig)
  if(configs.lib) activeConfigs.push(libraryConfig)

  return activeConfigs

}

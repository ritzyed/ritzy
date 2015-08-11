var _ = require('lodash')
var webpack = require('webpack')
var path = require('path')

module.exports = function(options) {

  // define these as globals in all packed files
  var GLOBALS = {
    'process.env.NODE_ENV': options.release ? '"production"' : '"development"',
    '__DEV__': !options.release
  }

  var AUTOPREFIXER_LOADER = 'autoprefixer-loader?{browsers:' + JSON.stringify(options.autoprefixer) + '}'

  //
  // Common configuration chunk to be used for both
  // client-side (client.js) and server-side (server.js) bundles
  // -----------------------------------------------------------------------------

  var config = {
    output: {
      path: options.builddir,
      publicPath: '',
      sourcePrefix: '  '
    },

    cache: !options.release,
    debug: !options.release,
    devtool: options.release ? false : '#inline-source-map',

    stats: {
      colors: true,
      reasons: options.verbose
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
  // Configuration for the client-side bundle (client.js)
  // -----------------------------------------------------------------------------

  var appConfig = _.merge({}, config, {
    entry: './src/client.js',
    output: {
      filename: 'client.js',
    },
    plugins: config.plugins.concat([
        new webpack.DefinePlugin(_.merge(GLOBALS, {'__SERVER__': false}))
      ].concat(options.release ? [
        new webpack.optimize.DedupePlugin(),
        new webpack.optimize.UglifyJsPlugin(),
        new webpack.optimize.AggressiveMergingPlugin()
      ] : [])
    )
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

  return [appConfig, serverConfig]

}

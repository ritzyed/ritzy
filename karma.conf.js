module.exports = function(config) {
  config.set({
    basePath: '',
    frameworks: ['mocha', 'chai'],
    files: [
      'src/tests/karma-test-entry.js',
      { pattern: 'src/**/*.js', included: false, served: false },
      'src/**/*.html'
    ],
    excluded: [
      '**/*-test.js'
    ],
    preprocessors: {
      'src/tests/karma-test-entry.js': ['webpack', 'sourcemap']
    },
    webpack: {
      devtool: 'inline-source-map',
      module: {
        loaders: [
          {
            test: /\.js$/,
            exclude: /node_modules/,
            loader: 'babel-loader'
          }
        ]
      }
    },
    webpackServer: {
      //quiet: true,
      stats: {
        colors: true
      }
    },
    client: {
      mocha: {
        reporter: 'html' // change Karma's debug.html to the mocha web reporter
      }
    },
    logLevel: config.LOG_INFO,
    browsers : ['Chrome', 'Firefox'],
    singleRun: true
  })
}

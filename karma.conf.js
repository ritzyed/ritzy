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
    // For IE testing in VMs see https://github.com/xdissent/karma-ievms or just connect to host port 9876 from the VM
    // iectrl open -s 10,11 http://<hostip>:9876/
    browsers : ['Chrome', 'Firefox'/*, 'IE10 - Win7', 'IE11 - Win7'*/],
    singleRun: true
  })
}

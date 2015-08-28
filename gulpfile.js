/* global argv */

// Include Gulp and other build automation tools and utilities
// See: https://github.com/gulpjs/gulp/blob/master/docs/API.md
var gulp = require('gulp')
var $ = require('gulp-load-plugins')()
var del = require('del')
var path = require('path')
var runSequence = require('run-sequence')
var webpack = require('webpack')
var options = require('minimist')(process.argv.slice(2), {
  alias: {
    debug: 'D',
    verbose: 'V'
  },
  boolean: ['debug', 'verbose'],
  default: {
    debug: false,
    verbose: false
  }
})

$.util.log('[args]', '   debug = ' + options.debug)
$.util.log('[args]', ' verbose = ' + options.verbose)

// https://github.com/ai/autoprefixer
options.autoprefixer = [
  'last 2 version'
]

var paths = {
  build: 'build',
  dist: 'dist',
  lib: 'lib',
  src: [
    'src/**/*.js',
    '!src/server.js',
    '!src/**/__tests__/**/*.js',
    '!src/**/__mocks__/**/*.js',
    '!src/assets/*',
    '!src/templates/*',
    '!src/tests/*'
  ]
}
var src = {
  assets: [
    'src/assets/**',
    'src/templates*/**'
  ],
  server: [
    paths.build + '/client.js',
    paths.build + '/server.js',
    paths.build + '/templates/**/*'
  ]
}
var watch = false
var browserSync

var DEVELOPMENT_HEADER = [
  '/**',
  ' * Ritzy v<%= version %>',
  ' */'
].join('\n') + '\n'

var PRODUCTION_HEADER = [
  '/**',
  ' * Ritzy v<%= version %>',
  ' *',
  ' * Copyright 2015, VIVO Systems, Inc.',
  ' * All rights reserved.',
  ' *',
  ' * This source code is licensed under the Apache v2 license found in the',
  ' * LICENSE.txt file in the root directory of this source tree.',
  ' *',
  ' */'
].join('\n') + '\n'

var webpackOpts = function(output, configs, debug) {
  return require('./webpack.config.js')(output, configs, debug, options.verbose, options.autoprefixer)
}
var webpackCompletion = function(err, stats) {
  if(err) {
    throw new $.util.PluginError('webpack', err, {showStack: true})
  }
  var jsonStats = stats.toJson()
  var statsOptions = { colors: true/*, modulesSort: 'size'*/ }
  if(jsonStats.errors.length > 0) {
    if(watch) {
      $.util.log('[webpack]', stats.toString(statsOptions))
    } else {
      throw new $.util.PluginError('webpack', stats.toString(statsOptions))
    }
  }
  if(jsonStats.warnings.length > 0 || options.verbose) {
    $.util.log('[webpack]', stats.toString(statsOptions))
  }
  if(jsonStats.errors.length === 0 && jsonStats.warnings.length === 0) {
    $.util.log('[webpack]', 'No errors or warnings.')
  }
}

// Check the version of node currently being used
gulp.task('node-version', function(cb) { // eslint-disable-line no-unused-vars
  return require('child_process').fork(null, {execArgv: ['--version']})
})

// The default task
gulp.task('default', ['serve'])

// Clean output directory
gulp.task('clean', ['clean:lib', 'clean:build', 'clean:dist'], del.bind(
  null, ['.tmp'], {dot: true}
))

gulp.task('clean:lib', del.bind(
  null, [paths.lib + '/*'], {dot: true}
))

gulp.task('clean:build', del.bind(
  null, [paths.build], {dot: true}
))

gulp.task('clean:dist', del.bind(
  null, [paths.dist + '/*', '!' + paths.dist + '/.git'], {dot: true}
))

// Static files
gulp.task('assets', function() {
  return gulp.src(src.assets)
    .pipe($.changed(paths.build))
    .pipe(gulp.dest(paths.build))
    .pipe($.size({title: 'assets'}))
})

var compile = function(cb, webpackConfigs) {
  var started = false
  function webpackCb(err, stats) {
    webpackCompletion(err, stats)
    if (!started) {
      started = true
      return cb()
    }
  }

  var compiler = webpack(webpackOpts(paths.build, webpackConfigs, true))
  if (watch) {
    compiler.watch(200, webpackCb)
  } else {
    compiler.run(webpackCb)
  }
}

gulp.task('compile:client', function(cb) {
  compile(cb, {client: true})
})

gulp.task('compile:server', function(cb) {
  compile(cb, {server: true})
})

// Build the app from source code
gulp.task('build', ['clean:build'], function(cb) {
  runSequence(['assets', 'compile:client', 'compile:server'], cb)
})

// Build and start watching for modifications
gulp.task('build:watch', function(cb) {
  watch = true
  runSequence('build', function(err) {
    gulp.watch(src.assets, ['assets'])
    cb(err)
  })
})

// Launch a Node.js/Express server
gulp.task('serve', ['build:watch'], function(cb) {
  var started = false
  var cp = require('child_process')
  var assign = require('react/lib/Object.assign')
  var nodeArgs = {}
  if(options.debug) {
    $.util.log('[node]', 'Node.js debug port set to 5858.')
    nodeArgs.execArgv = ['--debug-brk=5858']
  }

  var server = (function startup() {
    var child = cp.fork(paths.build + '/server.js', nodeArgs, {
      env: assign({NODE_ENV: 'development'}, process.env)
    })
    child.once('message', function(message) {
      if (message.match(/^online$/)) {
        if (browserSync) {
          browserSync.reload()
        }
        if (!started) {
          started = true
          gulp.watch(src.server, function() {
            $.util.log('Restarting development server.')
            server.kill('SIGTERM')
            server = startup()
          })
          cb()
        }
      }
    })
    return child
  })()
})

// Launch BrowserSync development server
gulp.task('sync', ['serve'], function(cb) {
  browserSync = require('browser-sync')

  browserSync({
    notify: false,
    // Run as an https by setting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    https: false,
    // Informs browser-sync to proxy our Express app which would run
    // at the following location
    proxy: 'localhost:5000'
  }, cb)

  process.on('exit', function() {
    browserSync.exit()
  })

  gulp.watch([paths.build + '/**/*.*'].concat(
    src.server.map(function(file) { return '!' + file })
  ), function(file) {
    browserSync.reload(path.relative(__dirname, file.path))
  })
})

gulp.task('modules', ['clean:lib'], function() {
  return gulp
    .src(paths.src, {base: 'src'})
    .pipe($.babel())
    .pipe(gulp.dest(paths.lib))
})

var dist = function(cb, header, debug, lib) {
  function webpackCb(err, stats) {
    webpackCompletion(err, stats)
    gulp.src(paths.build + '/' + lib)
      .pipe($.header(header, {
        version: process.env.npm_package_version
      }))
      .pipe(gulp.dest(paths.dist))
    return cb()
  }

  webpack(webpackOpts(paths.build, { lib: true, libName: lib }, debug), webpackCb)
}

gulp.task('dist:dev', ['modules'], function(cb) {
  return dist(cb, DEVELOPMENT_HEADER, true, 'ritzy.js')
})

gulp.task('dist:min', ['modules'], function(cb) {
  return dist(cb, PRODUCTION_HEADER, false, 'ritzy.min.js')
})

gulp.task('dist', ['clean:dist', 'dist:dev', 'dist:min'], function(cb) {
  return gulp.src('src/assets/fonts/**/*', {base: 'src/assets'})
    .pipe(gulp.dest(paths.dist))
})

gulp.task('docs', function() {
  var tests = ['-testb?\\.js$']
  gulp.src('src')
    .pipe($.esdoc({
      title: 'Ritzy: Collaborative web-based rich text editor',
      destination: paths.dist + '/docs',
      excludes: tests,
      access: ['public', 'protected', 'private'],
      test: {
        type: 'mocha',
        source: 'src/',
        includes: tests
      }/*,
      unexportIdentifier: true*/
    }))
})

// Deploy to GitHub Pages
gulp.task('deploy', function() {
  // Remove temp folder
  if (argv.clean) {
    var os = require('os')
    var repoPath = path.join(os.tmpdir(), 'tmpRepo')
    $.util.log('Delete ' + $.util.colors.magenta(repoPath))
    del.sync(repoPath, {force: true})
  }

  return gulp.src(paths.build + '/**/*')
    .pipe($.if('**/robots.txt', !argv.production ?
      $.replace('Disallow:', 'Disallow: /') : $.util.noop()))
    .pipe($.ghPages({
      remoteUrl: 'https://github.com/ritzyed/ritzy.github.io.git',
      branch: 'master'
    }))
})

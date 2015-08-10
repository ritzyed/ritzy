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
    release: 'r',
    debug: 'D',
    verbose: 'V',
    builddir: 'd'
  },
  boolean: ['release', 'debug', 'verbose'],
  default: {
    release: false,
    debug: false,
    verbose: false,
    builddir: './dist'
  }
})

$.util.log('[args]', ' release = ' + options.release)
$.util.log('[args]', '   debug = ' + options.debug)
$.util.log('[args]', ' verbose = ' + options.verbose)
$.util.log('[args]', 'builddir = ' + options.builddir)

// https://github.com/ai/autoprefixer
options.autoprefixer = [
  'last 2 version'
]

var src = {}
var watch = false
var browserSync

// Check the version of node currently being used
gulp.task('node-version', function(cb) {
  return require('child_process').fork(null, {execArgv: ['--version']})
})

// The default task
gulp.task('default', ['sync'])

// Clean output directory
gulp.task('clean', del.bind(
  null, ['.tmp', options.builddir + '/*', '!' + options.builddir + '/.git'], {dot: true}
))

// Static files
gulp.task('assets', function() {
  src.assets = [
    'src/assets/**',
    'src/templates*/**'
  ]
  return gulp.src(src.assets)
    .pipe($.changed(options.builddir))
    .pipe(gulp.dest(options.builddir))
    .pipe($.size({title: 'assets'}))
})

// Bundle
gulp.task('bundle', function(cb) {
  var started = false
  var config = require('./webpack.config.js')(options)
  var bundler = webpack(config)

  function bundle(err, stats) {
    if(err) {
      throw new $.util.PluginError('webpack', err, {showStack: true})
    }
    var jsonStats = stats.toJson()
    if(jsonStats.errors.length > 0) {
      if(watch) {
        $.util.log('[webpack]', stats.toString({colors: true}))
      } else {
        throw new $.util.PluginError('webpack', stats.toString({colors: true}))
      }
    }
    if(jsonStats.warnings.length > 0 || options.verbose) {
      $.util.log('[webpack]', stats.toString({colors: true}))
    }
    if(jsonStats.errors.length == 0 && jsonStats.warnings.length == 0) {
      $.util.log('[webpack]', "No errors or warnings.")
    }

    if (!started) {
      started = true
      return cb()
    }
  }

  if (watch) {
    bundler.watch(200, bundle)
  } else {
    bundler.run(bundle)
  }
})

// Build the app from source code
gulp.task('build', ['clean'], function(cb) {
  runSequence(['assets', 'bundle'], cb)
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
  src.server = [
    options.builddir + '/client.js',
    options.builddir + '/server.js',
    options.builddir + '/templates/**/*'
  ]

  var started = false
  var cp = require('child_process')
  var assign = require('react/lib/Object.assign')
  var nodeArgs = {}
  if(options.debug) {
    $.util.log('[node]', 'Node.js debug port set to 5858.')
    nodeArgs.execArgv = ['--debug-brk=5858']
  }

  var server = (function startup() {
    var child = cp.fork(options.builddir + '/server.js', nodeArgs, {
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

  gulp.watch([options.builddir + '/**/*.*'].concat(
    src.server.map(function(file) {return '!' + file;})
  ), function(file) {
    browserSync.reload(path.relative(__dirname, file.path))
  })
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

  return gulp.src(options.builddir + '/**/*')
    .pipe($.if('**/robots.txt', !argv.production ?
      $.replace('Disallow:', 'Disallow: /') : $.util.noop()))
    .pipe($.ghPages({
      remoteUrl: 'https://github.com/{name}/{name}.github.io.git',
      branch: 'master'
    }))
})

// Run Google's PageSpeed Insights (https://developers.google.com/speed/pagespeed/insights/)
gulp.task('pagespeed', function(cb) {
  var pagespeed = require('psi')
  // TODO Update the below URL to the public URL of our site
  pagespeed.output('example.com', {
    strategy: 'mobile'
    // By default we use the PageSpeed Insights free (no API key) tier.
    // Use a Google Developer API key if you have one: http://goo.gl/RkN0vE
    // key: 'YOUR_API_KEY'
  }, cb)
})

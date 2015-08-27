import React from 'react/addons'
import WebFont from 'webfontloader'
import OpenType from 'opentype.js'

import Editor from './components/Editor'
import { detectMinFontSize } from './core/dom'

/*
For performance analysis, bind React to the global scope (window) and then in console:
var Perf = window.React.addons.Perf
Perf.start()
... do some stuff ...
Perf.stop()
function printTiming(measurements) {
  Perf.printInclusive(measurements)
  Perf.printExclusive(measurements)
  Perf.printWasted(measurements)
}
printTiming(Perf.getLastMeasurements())
Perf.printDOM(Perf.getLastMeasurements())
*/
// window.React = React

let initConfig = function(config) {
  let defaultVal = function(key, defaultValue) {
    if(!config.hasOwnProperty(key)) {
      if(typeof defaultValue === 'function') {
        config[key] = defaultValue()
      } else {
        config[key] = defaultValue
      }
    }
  }

  let requireVal = function(key) {
    if(!config.hasOwnProperty(key)) {
      throw new Error(`Configuration must contain a property '${key}'.`)
    }
  }

  let webFontPromise = function(webFontFamily) {
    return new Promise(function(resolve, reject) {
      let webFontConfig = {
        classes: false,
        active() {
          resolve()
        },
        inactive() {
          reject(Error('Webfonts [' + JSON.stringify(webFontFamily) + '] could not be loaded.'))
        }
      }
      Object.keys(webFontFamily).forEach(k => webFontConfig[k] = webFontFamily[k])
      WebFont.load(webFontConfig)
    })
  }

  let otFontPromise = function(fontUrl) {
    return new Promise(function(resolve, reject) {
      OpenType.load(fontUrl, (err, font) => {
        if (err) {
          reject(Error('Opentype.js font ' + fontUrl + ' could not be loaded: ' + err))
        } else {
          resolve(font)
        }
      })
    })
  }

  defaultVal('localFontPath', '/fonts/')
  defaultVal('fontRegular', 'OpenSans-Regular-Latin.ttf')
  defaultVal('fontBold', 'OpenSans-Bold-Latin.ttf')
  defaultVal('fontBoldItalic', 'OpenSans-BoldItalic-Latin.ttf')
  defaultVal('fontItalic', 'OpenSans-Italic-Latin.ttf')
  defaultVal('webFontFamily', {
    google: {
      families: ['Open Sans:400italic,700italic,700,400']
    }
  })

  //noinspection JSUnresolvedVariable
  return Promise.all([
    otFontPromise(config.localFontPath + config.fontRegular),
    otFontPromise(config.localFontPath + config.fontBold),
    otFontPromise(config.localFontPath + config.fontBoldItalic),
    otFontPromise(config.localFontPath + config.fontItalic),
    webFontPromise(config.webFontFamily)
  ]).then(function(fontsResult) {
    config.fonts = {
      regular: fontsResult[0],
      bold: fontsResult[1],
      boldItalic: fontsResult[2],
      italic: fontsResult[3]
    }

    // all units per em must be the same (they are for OpenSans)
    config.unitsPerEm = fontsResult[0].unitsPerEm

    // we could detect minFontSize when needed (with this one-time approach, if the user changes it, they will need to refresh)
    config.minFontSize = detectMinFontSize()

    // if config.skin is undefined or 'default', we load default-skin.less
    defaultVal('skin', 'default')
    if(config.skin === 'default') {
      require('./styles/default-skin.less')
    }

    requireVal('id')
    requireVal('fonts')
    defaultVal('fontSize', 18)
    requireVal('minFontSize')
    requireVal('unitsPerEm')
    defaultVal('width', 600)
    defaultVal('marginH', 30)
    defaultVal('marginV', 35)
    defaultVal('userId', () => {
      let localUser = window.localStorage.getItem('localuser') || 'A' + parseInt(Math.random() * 10000).toString(16)
      window.localStorage.setItem('localuser', localUser)
      return localUser
    })
    defaultVal('userName', config.userId)
    defaultVal('wsPort', null)
    defaultVal('renderOptimizations', true)
    defaultVal('showErrorNotification', true)

    return config
  })
}

let renderEditor = function(config, renderTarget) {
  const editorFactory = React.createFactory(Editor)
  React.render(
    editorFactory(config),
    renderTarget
  )
}

export default function RitzyFactory(config, renderTarget, eventEmitter) {
  let EventEmitter = eventEmitter ? eventEmitter : require('eventemitter3')

  class Ritzy extends EventEmitter {
    constructor(config, target) {
      super()
      this.renderTarget = target

      this.update = () => {
        renderEditor(this.config, this.renderTarget)
      }
      this.load = (onLoadError) => {
        initConfig(config).then((c) => {
          this.config = c
          this.update()
        }).catch(function(err) {
          console.error('Editor loading failed.', err)
          if(typeof onLoadError === 'function') {
            onLoadError(err)
          }
        })
      }
    }

    hasListeners(event) {
      // uses EventEmitter3 existence checking mechanism, for other emitters this won't work
      return this.listeners(event, true)
    }

    updateConfig(property, value) {
      this.config[property] = value
      this.update()
    }
  }

  return new Ritzy(config, renderTarget)
}

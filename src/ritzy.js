import React from 'react/addons'
import WebFont from 'webfontloader'
import OpenType from 'opentype.js'

import Editor from './components/Editor'
import { detectMinFontSize } from './core/dom'

let renderEditor = function(config, renderTarget) {
  let configDefault = function(key, defaultValue) {
    if(!config[key]) {
      if(typeof defaultValue === 'function') {
        config[key] = defaultValue()
      } else {
        config[key] = defaultValue
      }
    }
  }

  let configRequire = function(key) {
    if(!config[key]) {
      throw new Error(`Configuration must contain a property '${key}'.`)
    }
  }

  configRequire('id')
  configRequire('fonts')
  configDefault('fontSize', 18)
  configRequire('minFontSize')
  configRequire('unitsPerEm')
  configDefault('width', 600)
  configDefault('marginH', 30)
  configDefault('marginV', 35)
  configDefault('userId', () => {
    let localUser = window.localStorage.getItem('localuser') || 'A' + parseInt(Math.random() * 10000).toString(16)
    window.localStorage.setItem('localuser', localUser)
    return localUser
  })
  configDefault('userName', config.userId)

  const editorFactory = React.createFactory(Editor)

  React.render(
    editorFactory(config),
    renderTarget
  )
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

function render(config, renderTarget) {
  let configDefault = function(key, defaultValue) {
    if(!config[key]) {
      config[key] = defaultValue
    }
  }

  // if config.skin is undefined or 'default', we load default-skin.less
  configDefault('skin', 'default')
  if(config.skin === 'default') {
    require('./styles/default-skin.less')
  }

  configDefault('localFontPath', '/fonts/')
  configDefault('fontRegular', 'OpenSans-Regular-Latin.ttf')
  configDefault('fontBold', 'OpenSans-Bold-Latin.ttf')
  configDefault('fontBoldItalic', 'OpenSans-BoldItalic-Latin.ttf')
  configDefault('fontItalic', 'OpenSans-Italic-Latin.ttf')
  configDefault('webFontFamily', {
    google: {
      families: ['Open Sans:400italic,700italic,700,400']
    }
  })

  //noinspection JSUnresolvedVariable
  Promise.all([
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

    renderEditor(config, renderTarget)
  }).catch(function(err) {
    console.error('Editor loading failed.', err)
    if(typeof config.onLoadError === 'function') {
      config.onLoadError(err)
    }
  })
}

export default function RitzyFactory(config, eventEmitter) {
  let EventEmitter = eventEmitter ? eventEmitter : require('eventemitter3')

  class Ritzy extends EventEmitter {
    constructor(c) {
      super()
      this.render = function(renderTarget) {
        render(c, renderTarget)
      }
    }
  }

  return new Ritzy(config)
}

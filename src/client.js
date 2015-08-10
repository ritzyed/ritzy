import 'babel/polyfill'

import React from 'react/addons'
import WebFont from 'webfontloader'
import OpenType from 'opentype.js'
import Editor from './components/Editor'
import { detectMinFontSize } from './core/dom'

// skinning, this could be imported in the HTML in the traditional way as well
require('default-skin.less')

let renderEditor = function(fonts, unitsPerEm, minFontSize) {
  const editorFactory = React.createFactory(Editor)
  const editorRenderTarget = document.getElementById('content')

  let localUser = window.localStorage.getItem('localuser') || 'A' + parseInt(Math.random() * 10000).toString(16)
  window.localStorage.setItem('localuser', localUser)

  let userName = 'Name of ' + localUser

  React.render(
    editorFactory({
      id: 10,
      fonts: fonts,
      fontSize: 18,
      minFontSize: minFontSize,
      unitsPerEm: unitsPerEm,
      width: 600,
      marginH: 30,
      marginV: 35,
      userId: localUser,
      userName: userName
    }),
    editorRenderTarget
  )
}

let webFontPromise = function() {
  return new Promise(function(resolve, reject) {
    let families = ['Open Sans:400italic,700italic,700,400']
    WebFont.load({
      classes: false,
      google: {
        families: families
      },
      active() {
        resolve()
      },
      inactive() {
        reject(Error('Webfonts ' + families + ' could not be loaded.'))
      }
    })
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

Promise.all([
  otFontPromise('/fonts/OpenSans-Regular-Latin.ttf'),
  otFontPromise('/fonts/OpenSans-Bold-Latin.ttf'),
  otFontPromise('/fonts/OpenSans-BoldItalic-Latin.ttf'),
  otFontPromise('/fonts/OpenSans-Italic-Latin.ttf'),
  webFontPromise()
]).then(function(fonts) {
  // all units per em must be the same (they are for OpenSans)
  // we could detect minFontSize when needed (with this one-time approach, if the user changes it, they will need to refresh)
  renderEditor({
    regular: fonts[0],
    bold: fonts[1],
    boldItalic: fonts[2],
    italic: fonts[3]
  }, fonts[0].unitsPerEm, detectMinFontSize())
}).catch(function(err) {
  // TODO handle error by just using a sans-serif fallback and dealing with either or both of opentype/webfont fails
  console.error('Editor loading failed.', err)
  document.getElementById('content').innerHTML = 'Oops, I couldn\'t load the editor.'
})

import React from 'react/addons'
import OpenType from 'opentype.js'
import Editor from './components/Editor'
import { detectMinFontSize } from './core/dom'

let renderEditor = function(fonts, unitsPerEm, minFontSize) {
  const editorFactory = React.createFactory(Editor)
  const editorRenderTarget = document.getElementById('content')
  React.render(
    editorFactory({
      id: 10,
      fonts: fonts,
      minFontSize: minFontSize,
      unitsPerEm: unitsPerEm
    }),
    editorRenderTarget
  )
}

let fontPromise = function(fontUrl) {
  return new Promise(function(resolve, reject){
    OpenType.load(fontUrl, (err, font) => {
      if (err) {
        reject(Error('Font ' + fontUrl + ' could not be loaded: ' + err))
      } else {
        resolve(font)
      }
    })
  })
}

Promise.all([
  fontPromise('/fonts/OpenSans-Regular-Latin.ttf'),
  fontPromise('/fonts/OpenSans-Bold-Latin.ttf'),
  fontPromise('/fonts/OpenSans-BoldItalic-Latin.ttf'),
  fontPromise('/fonts/OpenSans-Italic-Latin.ttf')
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
  // TODO handle error with some type of oops screen
  console.error('Font loading failed.', err)
  document.getElementById('content').innerHTML = 'Oops, I couldn\'t load all the resources needed.'
})

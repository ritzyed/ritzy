/**
 * This is the main entry point to the Ritzy editor. See client.js for an example of how it can be used. This
 * is basically an API wrapper around the Editor react component, which can be used directly as well.
 */
import React from 'react/addons'
import WebFont from 'webfontloader'
import OpenType from 'opentype.js'

import Editor from './components/Editor'
import EditorStore from './flux/EditorStore'
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

/**
 * Obtains an instance of Ritzy for the given config, renderTarget DOM element, and (optionally) an event
 * emitter.
 * @param config
 * @param {Element} renderTarget The DOM element into which to render the editor.
 * @param {EventEmitter} [eventEmitter=eventemitter3] An event emitter to use (defaults to EventEmitter3).
 * @returns {Ritzy}
 * @constructor
 */
export default function RitzyFactory(config, renderTarget, eventEmitter) {
  let EventEmitter = eventEmitter ? eventEmitter : require('eventemitter3')

  /**
   * Ritzy class.
   */
  class Ritzy extends EventEmitter {
    constructor(config, target) {
      super()
      this.renderTarget = target

      this.update = () => {
        renderEditor(this.config, this.renderTarget)
      }
      this.load = (onLoadError) => {
        initConfig(config).then((c) => {
          c.eventEmitter = this
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

    /**
     * Sets the user name of the editor's user, which will be associated with all remote cursors that
     * represent the cursor in this editor. Updates remote cursors immediately.
     * @apidoc Configuration
     * @param userName The user name to set.
     * @returns {*}
     */
    setUserName(userName) {
      this.updateConfig('userName', userName)
    }

    /**
     * Sets the editor font size, and update the editor contents immediately to reflect this.
     * @apidoc Configuration
     * @param fontSize The font size, in pixels, to set.
     * @returns {*}
     */
    setFontSize(fontSize) {
      this.updateConfig('fontSize', fontSize)
    }

    /**
     * Sets the editor width in pixels, and update the editor immediately to reflect this.
     * @apidoc Configuration
     * @param width The width of the editor in pixels. This includes the internal margins.
     * @returns {*}
     */
    setWidth(width) {
      this.updateConfig('width', width)
    }

    /**
     * Sets the editor internal margins, and update the editor contents immediately to reflect this.
     * Margins provide a useful "click area" where the user can click to go to the beginning
     * or end of a line (or first or last line) without being super-precise about the click.
     * @apidoc Configuration
     * @param horizontal The horizontal (left-right) margins.
     * @param vertical The vertical (top-bottom) margins.
     * @returns {*}
     */
    setMargin(horizontal, vertical) {
      this.updateConfig('margin', { horizontal: horizontal, vertical: vertical })
    }

    /**
     * Sets the editor internal horizontal margin.
     * @apidoc Configuration
     * @param horizontal The horizontal (left-right) margins.
     * @returns {*}
     */
    setMarginHorizontal(horizontal) {
      let margin = { horizontal: horizontal, vertical: this.config.margin.vertical }
      this.updateConfig('margin', margin)
    }

    /**
     * Sets the editor internal vertical margin.
     * @apidoc Configuration
     * @param vertical The vertical (top-bottom) margins.
     * @returns {*}
     */
    setMarginVertical(vertical) {
      let margin = { horizontal: this.config.margin.horizontal, vertical: vertical }
      this.updateConfig('margin', margin)
    }

    /**
     * Returns the contents of the editor as an array of Char objects. The Char object is from the
     * underlying CRDT data store.
     * @apidoc Contents
     * @returns Array[Char]
     */
    getContents() {
      return EditorStore.getContents()
    }

    /**
     * Returns the contents of the editor in a rich text JSON format representing the rich text chunks and the
     * associated attributes.
     * @apidoc Contents
     * @returns {*}
     */
    getContentsRich() {
      return EditorStore.getContentsRich()
    }

    /**
     * Returns the contents of the editor as HTML.
     * @apidoc Contents
     * @returns {*}
     */
    getContentsHtml() {
      return EditorStore.getContentsHtml()
    }

    /**
     * Returns the contents of the editor as plain text.
     * @apidoc Contents
     * @returns {*}
     */
    getContentsText() {
      return EditorStore.getContentsText()
    }

    /**
     * Returns the contents of the current selection as an array of Char objects. The Char object is from the
     * underlying CRDT data store.
     * Returns the contents of the current selection in the underlying CRDT data storage format.
     * @apidoc Selection
     * @returns Array[Char]
     */
    getSelection() {
      return EditorStore.getSelection()
    }

    /**
     * Returns the contents of the current selection in a rich text JSON format representing the rich text chunks
     * and the associated attributes.
     * @apidoc Selection
     * @returns {*}
     */
    getSelectionRich() {
      return EditorStore.getSelectionRich()
    }

    /**
     * Returns the contents of the current selection as HTML.
     * @apidoc Selection
     * @returns {*}
     */
    getSelectionHtml() {
      return EditorStore.getSelectionHtml()
    }

    /**
     * Returns the contents of the current selection as plain text.
     * @apidoc Selection
     * @returns {*}
     */
    getSelectionText() {
      return EditorStore.getSelectionText()
    }

    /**
     * Returns the current position of the local cursor. The position is a character at which the cursor is placed
     * (the point just after the character), and an eolStart attribute. The eolStart attribute is when the position is
     * at the character at the end of a line (will generally be space if it is a soft break, and a newline if it is a
     * hard break), if eolStart is false the cursor is at the end of the line with that character, and if eolStart is
     * true, the cursor is at the start of the next line. This is necessary because both cursor positions represent
     * the *same* character position.
     * @apidoc Cursors
     * @returns {*}
     */
    getPosition() {
      return EditorStore.getPosition()
    }

    /**
     * Gets all remote cursors currently active in the document. Each remote cursor has attributes such as name
     * ('name'), the last update time ('ms'), and the remote position of the cursor.
     * @apidoc Cursors
     * @returns Array[{*}]
     */
    getRemoteCursors() {
      return EditorStore.getRemoteCursors()
    }

    /**
     * Register a callback that executes when the cursor position changes.
     *
     * The underlying event emitter event name is 'position-change'.
     *
     * @apidoc Events
     * @param cb Callback with the following parameters:
     *   ** position - The new position.
     */
    onPositionChange(cb) {
      this.on('position-change', cb)
    }

    /**
     * Register a callback that executes when the selection changes. This event will also be raised when an active
     * selection is destroyed -- the selection parameter in the callback will be null in this case.
     *
     * The underlying event emitter event name is 'selection-change'.
     *
     * @apidoc Events
     * @param cb Callback with the following parameters:
     *   ** selection - The new selection in native CRDT format. The left char of the selection is exclusive and the right char is inclusive.
     */
    onSelectionChange(cb) {
      this.on('selection-change', cb)
    }

    /**
     * Register a callback that executes when the editor gains focus.
     *
     * The underlying event emitter event name is 'focus-gained'.
     *
     * @apidoc Events
     * @param cb Callback with no parameters.
     */
    onFocusGained(cb) {
      this.on('focus-gained', cb)
    }

    /**
     * Register a callback that executes when the editor loses focus (blur).
     *
     * The underlying event emitter event name is 'focus-lost'.
     *
     * @apidoc Events
     * @param cb Callback with no parameters.
     */
    onFocusLost(cb) {
      this.on('focus-lost', cb)
    }

    /**
     * Register a callback that executes when a remote cursor is added.
     *
     * The underlying event emitter event name is 'remote-cursor-add'.
     *
     * @apidoc Events
     * @param cb Callback with the following parameters:
     *   ** remoteCursor - The remote cursor that was added.
     */
    onRemoteCursorAdd(cb) {
      this.on('remote-cursor-add', cb)
    }

    /**
     * Register a callback that executes when a remote cursor is removed.
     *
     * The underlying event emitter event name is 'remote-cursor-remove'.
     *
     * @apidoc Events
     * @param cb Callback with the following parameters:
     *   ** remoteCursor - The remote cursor that was removed.
     */
    onRemoteCursorRemove(cb) {
      this.on('remote-cursor-remove', cb)
    }

    /**
     * Register a callback that executes when the name associated with a remote cursor has changed.
     *
     * The underlying event emitter event name is 'remote-cursor-change-name'.
     *
     * @apidoc Events
     * @param cb Callback with the following parameters:
     *   ** remoteCursor - The remote cursor with the changed name.
     *   ** oldName - The old name.
     *   ** newName - The new name.
     */
    onRemoteCursorChangeName(cb) {
      this.on('remote-cursor-change-name', cb)
    }

    /**
     * Register a callback that executes when text is inserted into the editor.
     *
     * The underlying event emitter event name is 'text-insert'.
     *
     * @apidoc Events
     * @param cb Callback with the following parameters:
     *   ** atPosition - The char position at which the insert occurred.
     *   ** value - The text string that was inserted.
     *   ** attributes - The rich attributes associated with the inserted text.
     *   ** newPosition - The new position of the cursor after the insert is done. An `onPositionChange` event will also be raised separately.
     */
    onTextInsert(cb) {
      this.on('text-insert', cb)
    }

    /**
     * Register a callback that executes when text is deleted from the editor.
     *
     * The underlying event emitter event name is 'text-delete'.
     *
     * @apidoc Events
     * @param cb Callback with the following parameters:
     *   ** from - The char position from which text was deleted (exclusive).
     *   ** to - The char position to which text was deleted (inclusive).
     *   ** newPosition - The new position of the cursor after the insert is done. An `onPositionChange` event will also be raised separately.
     */
    onTextDelete(cb) {
      this.on('text-delete', cb)
    }
  }

  return new Ritzy(config, renderTarget)
}

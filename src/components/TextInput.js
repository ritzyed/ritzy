import 'babel/polyfill'

import React from 'react/addons'
import getEventKey from 'react/lib/getEventKey'
import Mousetrap from 'mousetrap'
import parseHtml from '../core/htmlparser'
import writeHtml from '../core/htmlwriter'
import writeText from '../core/textwriter'
import {emptyNode} from '../core/dom'

const batchedUpdates = React.addons.batchedUpdates
const T = React.PropTypes
const MIME_TYPE_TEXT_PLAIN = 'text/plain'
const MIME_TYPE_TEXT_HTML = 'text/html'
const MIME_TYPE_RITZY_RICH_TEXT = 'application/x-ritzy-rt'

// alphabet lower case +
// alphabet upper case case +
// numerals +
// space +
// special chars (_KEYCODE_MAP in mousetrap) +
// keys requiring shift (_SHIFT_MAP in mousetrap) +
// { and } which were missing from mousetrap _SHIFT_MAP
// common special chars (TODO)
// TODO non-english language/char entry
/* eslint-disable comma-spacing */
const ALL_CHARS = [
  'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
  'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
  '0','1','2','3','4','5','6','7','8','9',
  'space',
  '*','+','-','.','/',';','=',',','-','.','/','`','[','\\',']','\'',
  '~','!','@','#','$','%','^','&','*','(',')','_','+',':','\"','<','>','?','|',
  '{','}',
  'é','è'
]
/* eslint-enable comma-spacing */

export default React.createClass({
  propTypes: {
    id: T.number.isRequired,
    position: T.number.isRequired,
    insertChars: T.func.isRequired,
    insertCharsBatch: T.func.isRequired,
    navigateLeft: T.func.isRequired,
    navigateRight: T.func.isRequired,
    navigateUp: T.func.isRequired,
    navigateDown: T.func.isRequired,
    navigatePageUp: T.func.isRequired,
    navigatePageDown: T.func.isRequired,
    navigateStart: T.func.isRequired,
    navigateStartLine: T.func.isRequired,
    navigateEnd: T.func.isRequired,
    navigateEndLine: T.func.isRequired,
    navigateWordLeft: T.func.isRequired,
    navigateWordRight: T.func.isRequired,
    selectionLeft: T.func.isRequired,
    selectionRight: T.func.isRequired,
    selectionUp: T.func.isRequired,
    selectionDown: T.func.isRequired,
    selectionPageUp: T.func.isRequired,
    selectionPageDown: T.func.isRequired,
    selectionStart: T.func.isRequired,
    selectionStartLine: T.func.isRequired,
    selectionEnd: T.func.isRequired,
    selectionEndLine: T.func.isRequired,
    selectionWordLeft: T.func.isRequired,
    selectionWordRight: T.func.isRequired,
    selectionAll: T.func.isRequired,
    eraseCharBack: T.func.isRequired,
    eraseCharForward: T.func.isRequired,
    eraseWordBack: T.func.isRequired,
    eraseWordForward: T.func.isRequired,
    eraseSelection: T.func.isRequired,
    toggleBold: T.func.isRequired,
    toggleItalics: T.func.isRequired,
    toggleUnderline: T.func.isRequired,
    toggleStrikethrough: T.func.isRequired,
    toggleSuperscript: T.func.isRequired,
    toggleSubscript: T.func.isRequired,
    getSelection: T.func.isRequired
  },

  mixins: [React.addons.PureRenderMixin],

  componentDidMount() {
    // React does not batch setState calls inside events raised by mousetrap, create a wrapper to do that
    this.input = React.findDOMNode(this.refs.input)
    this.hiddenContainer = React.findDOMNode(this.refs.hiddenContainer)
    this.ieClipboardDiv = React.findDOMNode(this.refs.ieClipboardDiv)

    // for HTML paste support in IE -- ignored by Chrome/Firefox
    this.input.addEventListener('beforepaste', () => {
      if (document.activeElement !== this.ieClipboardDiv) {
        this._focusIeClipboardDiv()
      }
    }, true)

    let keyBindingsReal = new Mousetrap(this.input)

    // the wrapper function returns the function that will be called by Mousetrap with two args: keyEvent and combo
    let wrapperFunction = (handler) => (keyEvent, combo) => {
      let returnValue
      batchedUpdates(() => returnValue = handler(keyEvent, combo))
      return returnValue
    }
    let keyBindings = {
      bind(binding, handler) {
        keyBindingsReal.bind(binding, wrapperFunction(handler))
      }
    }

    // TODO probably ALL_CHARS should be handled via onInput instead to avoid keycode translation
    keyBindings.bind(ALL_CHARS, this._handleKeyChar)
    keyBindings.bind(['up', 'down', 'left', 'right'], this._handleKeyArrow)
    keyBindings.bind(['shift+up', 'shift+down', 'shift+left', 'shift+right'], this._handleKeySelectionArrow)
    keyBindings.bind(['pageup', 'pagedown'], this._handleKeyNavigationPage)
    keyBindings.bind(['shift+pageup', 'shift+pagedown'], this._handleKeySelectionPage)
    keyBindings.bind(['ctrl+home', 'home', 'ctrl+end', 'end'], this._handleKeyNavigationHomeEnd)
    keyBindings.bind(['ctrl+shift+home', 'shift+home', 'ctrl+shift+end', 'shift+end'], this._handleKeySelectionHomeEnd)
    keyBindings.bind(['ctrl+left', 'ctrl+right'], this._handleKeyNavigationWord)
    keyBindings.bind(['shift+ctrl+left', 'shift+ctrl+right'], this._handleKeySelectionWord)
    keyBindings.bind('ctrl+a', this._handleKeySelectionAll)
    keyBindings.bind('backspace', this._handleKeyBackspace)
    keyBindings.bind('del', this._handleKeyDelete)
    keyBindings.bind('ctrl+backspace', this._handleKeyWordBackspace)
    keyBindings.bind('ctrl+del', this._handleKeyWordDelete)
    //keyBindings.bind('ctrl+s', this._handleKeySave)
    //keyBindings.bind('tab', this._handleKeyTab)
    keyBindings.bind('enter', this._handleKeyEnter)
    //keyBindings.bind('ctrl+z', this._handleUndo)
    //keyBindings.bind('ctrl+y', this._handleRedo)

    keyBindings.bind('ctrl+b', this._handleKeyBold)
    keyBindings.bind('ctrl+i', this._handleKeyItalics)
    keyBindings.bind('ctrl+u', this._handleKeyUnderline)
    keyBindings.bind('alt+shift+5', this._handleKeyStrikethrough)
    keyBindings.bind('ctrl+.', this._handleKeySuperscript)
    keyBindings.bind('ctrl+,', this._handleKeySubscript)

    // TODO figure out tab, enter, return, pageup, pagedown, end, home, ins
  },

  focus() {
    this._checkEmptyValue()
    this.input.focus()

    // IE requires a non-empty selection in order to fire the copy event, annoying
    this.input.value = ' '
    this._selectNodeContents(this.input)
  },

  _selectNodeContents(node) {
    let range = document.createRange()
    range.selectNodeContents(node)
    let selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  },

  _checkEmptyValue() {
    let value = this.input.value
    if(value.length > 0 && value !== ' ') {
      console.error('The hidden input area is not empty, missed an event? Value=', value)
    }
  },

  _handleKeyChar(e) {
    this._checkEmptyValue()

    // use React's DOM-L3 events polyfill to convert the native event into a key
    let key = getEventKey(e)
    if(key === 'Enter') {
      key = '\n'
    }
    this.props.insertChars(key)
    return false
  },

  _handleKeyArrow(e, key) {
    this._checkEmptyValue()

    if(key === 'left') {
      this.props.navigateLeft()
    } else if(key === 'right') {
      this.props.navigateRight()
    } else if(key === 'up') {
      this.props.navigateUp()
    } else if(key === 'down') {
      this.props.navigateDown()
    }
    return false
  },

  _handleKeySelectionArrow(e, key) {
    this._checkEmptyValue()

    if(key === 'shift+left') {
      this.props.selectionLeft()
    } else if(key === 'shift+right') {
      this.props.selectionRight()
    } else if(key === 'shift+up') {
      this.props.selectionUp()
    } else if(key === 'shift+down') {
      this.props.selectionDown()
    }
    return false
  },

  _handleKeyBackspace() {
    this._checkEmptyValue()

    this.props.eraseCharBack()
    return false
  },

  _handleKeyDelete() {
    this._checkEmptyValue()

    this.props.eraseCharForward()
    return false
  },

  _handleKeyWordBackspace() {
    this._checkEmptyValue()

    this.props.eraseWordBack()
    return false
  },

  _handleKeyWordDelete() {
    this._checkEmptyValue()

    this.props.eraseWordForward()
    return false
  },

  _handleKeyEnter() {
    this._checkEmptyValue()

    this.props.insertChars('\n')
    return false
  },

  _handleKeyNavigationPage(e, key) {
    if(key === 'pageup') {
      this.props.navigatePageUp()
    } else if(key === 'pagedown') {
      this.props.navigatePageDown()
    }
    return false
  },

  _handleKeySelectionPage(e, key) {
    if(key === 'shift+pageup') {
      this.props.selectionPageUp()
    } else if(key === 'shift+pagedown') {
      this.props.selectionPageDown()
    }
    return false
  },

  _handleKeyNavigationHomeEnd(e, key) {
    if(key === 'ctrl+home') {
      this.props.navigateStart()
    } else if(key === 'home') {
      this.props.navigateStartLine()
    } else if(key === 'ctrl+end') {
      this.props.navigateEnd()
    } else if(key === 'end') {
      this.props.navigateEndLine()
    }
    return false
  },

  _handleKeyNavigationWord(e, key) {
    this._checkEmptyValue()

    if(key === 'ctrl+left') {
      this.props.navigateWordLeft()
    } else if(key === 'ctrl+right') {
      this.props.navigateWordRight()
    }
    return false
  },

  _handleKeySelectionHomeEnd(e, key) {
    if(key === 'ctrl+shift+home') {
      this.props.selectionStart()
    } else if(key === 'shift+home') {
      this.props.selectionStartLine()
    } else if(key === 'ctrl+shift+end') {
      this.props.selectionEnd()
    } else if(key === 'shift+end') {
      this.props.selectionEndLine()
    }

    return false
  },

  _handleKeySelectionWord(e, key) {
    if(key === 'shift+ctrl+left') {
      this.props.selectionWordLeft()
    } else if(key === 'shift+ctrl+right') {
      this.props.selectionWordRight()
    }
    return false
  },

  _handleKeySelectionAll() {
    this.props.selectionAll()
    return false
  },

  _handleKeyBold() {
    this.props.toggleBold()
    return false
  },

  _handleKeyItalics() {
    this.props.toggleItalics()
    return false
  },

  _handleKeyUnderline() {
    this.props.toggleUnderline()
    return false
  },

  _handleKeyStrikethrough() {
    this.props.toggleStrikethrough()
    return false
  },

  _handleKeySuperscript() {
    this.props.toggleSuperscript()
    return false
  },

  _handleKeySubscript() {
    this.props.toggleSubscript()
    return false
  },

  _onCopy(e) {
    let selectionChunks = this.props.getSelection()

    if(selectionChunks && selectionChunks.length > 0) {
      let copiedText = writeText(selectionChunks)
      let copiedHtml = writeHtml(selectionChunks)
      if(window.clipboardData) {
        this._handleIeCopy(copiedText, copiedHtml)
      } else {
        this._handleNormalCopy(e, selectionChunks, copiedText, copiedHtml)
      }
    }
  },

  _onCut(e) {
    this._onCopy(e)
    this.props.eraseSelection()
  },

  _handleNormalCopy(e, selectionChunks, copiedText, copiedHtml) {
    e.clipboardData.setData(MIME_TYPE_TEXT_PLAIN, copiedText)
    e.clipboardData.setData(MIME_TYPE_TEXT_HTML, copiedHtml)
    // some browsers e.g. Chrome support arbitrary MIME types, makes paste way more efficient
    // Firefox allows setting the type, but not pasting it -- see https://bugzilla.mozilla.org/show_bug.cgi?id=860857
    e.clipboardData.setData(MIME_TYPE_RITZY_RICH_TEXT, JSON.stringify(selectionChunks))
    e.preventDefault()
    e.stopPropagation()
  },

  _handleIeCopy(copiedText, copiedHtml) {
    window.clipboardData.setData('Text', copiedText)
    this.ieClipboardDiv.innerHTML = copiedHtml
    this._focusIeClipboardDiv()
    this._selectNodeContents(this.ieClipboardDiv)
    setTimeout(() => {
      emptyNode(this.ieClipboardDiv)
      this.focus()
    }, 0)
  },

  _onPaste(e) {
    this._checkEmptyValue()
    if(e.clipboardData.types) {
      this._handleNormalPaste(e)
    } else {
      // IE does not provide access to HTML in the paste event but does allow HTML to paste into a contentEditable
      // see http://stackoverflow.com/a/27279218/430128
      this._handleIePaste()
    }
  },

  _handleNormalPaste(e) {
    let clipboardDataTypes
    if(e.clipboardData.types.findIndex) {
      clipboardDataTypes = e.clipboardData.types
    } else {
      // Firefox uses DOMStringList instead of an array type, convert it
      clipboardDataTypes = Array.from(e.clipboardData.types)
    }

    if(clipboardDataTypes.findIndex(t => t === MIME_TYPE_RITZY_RICH_TEXT) > -1) {
      let pasted = e.clipboardData.getData(MIME_TYPE_RITZY_RICH_TEXT)
      this.props.insertCharsBatch(JSON.parse(pasted))
    } else if(clipboardDataTypes.findIndex(t => t === MIME_TYPE_TEXT_HTML) > -1) {
      let pasted = e.clipboardData.getData(MIME_TYPE_TEXT_HTML)
      let pastedChunks = parseHtml(pasted, this.hiddenContainer)
      this.props.insertCharsBatch(pastedChunks)
    } else if(clipboardDataTypes.findIndex(t => t === MIME_TYPE_TEXT_PLAIN) > -1) {
      let pasted = e.clipboardData.getData(MIME_TYPE_TEXT_PLAIN)
      this.props.insertChars(pasted)
    } else {
      console.warn('Paste not supported yet for types: ' + JSON.stringify(clipboardDataTypes))
    }
    e.preventDefault()
    e.stopPropagation()
  },

  _handleIePaste() {
    setTimeout(() => {
      let pasted = this.ieClipboardDiv.innerHTML
      try {
        let pastedChunks = parseHtml(pasted, this.hiddenContainer)
        this.props.insertCharsBatch(pastedChunks)
      } finally {
        emptyNode(this.ieClipboardDiv)
        this.focus()
      }
    }, 0)
  },

  _focusIeClipboardDiv() {
    this.ieClipboardDiv.focus()
  },

  _onInput(e) {
    // catch inputs that our keyboard handler doesn't catch e.g. compose key, IME inputs, etc.
    let value = e.target.value
    e.target.value = ' '
    this.props.insertChars(value)
  },

  render() {
    let divStyle = {
      position: 'absolute',
      overflow: 'hidden',
      height: 0,
      outline: 'none',
      left: 0,
      top: this.props.position
    }

    // we can't focus an element with display: none so wrap them in another invisible div
    return (
      <div style={divStyle}>
        <textarea key="input" ref="input" onInput={this._onInput}
          onCopy={this._onCopy} onCut={this._onCut} onPaste={this._onPaste}/>
        <div style={{display: 'none'}} ref="hiddenContainer"></div>
        <div contentEditable="true" ref="ieClipboardDiv" onPaste={this._onPaste}></div>
      </div>
    )
  }

})

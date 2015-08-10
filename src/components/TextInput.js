import _ from 'lodash'
import React from 'react/addons'
import getEventKey from 'react/lib/getEventKey'
import Mousetrap from 'mousetrap'

import EditorActions from '../flux/EditorActions'
import parseHtml from '../core/htmlparser'
import {emptyNode} from '../core/dom'

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
    focused: T.bool.isRequired
  },

  componentDidMount() {
    this.input = React.findDOMNode(this.refs.input)
    this.hiddenContainer = React.findDOMNode(this.refs.hiddenContainer)
    this.ieClipboardDiv = React.findDOMNode(this.refs.ieClipboardDiv)

    // for HTML paste support in IE -- ignored by Chrome/Firefox
    this.input.addEventListener('beforepaste', () => {
      if (document.activeElement !== this.ieClipboardDiv) {
        this._focusIeClipboardDiv()
      }
    }, true)

    let keyBindings = new Mousetrap(this.input)

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

    if(this.props.focused) {
      this._focus()
    }
  },

  shouldComponentUpdate(nextProps) {
    return this.props.focused !== nextProps.focused || this.props.position !== nextProps.position
  },

  componentDidUpdate() {
    if(this.props.focused) {
      this._focus()
    }
  },

  _focus() {
    this._checkEmptyValue()

    this.ieClipboardDivFocus = false

    // IE requires a non-empty selection in order to fire the copy event, annoying
    this.input.value = ' '
    this.input.focus()
    this.input.select()
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
    EditorActions.insertChars(key)
    return false
  },

  _handleKeyArrow(e, key) {
    this._checkEmptyValue()

    if(key === 'left') {
      EditorActions.navigateLeft()
    } else if(key === 'right') {
      EditorActions.navigateRight()
    } else if(key === 'up') {
      EditorActions.navigateUp()
    } else if(key === 'down') {
      EditorActions.navigateDown()
    }
    return false
  },

  _handleKeySelectionArrow(e, key) {
    this._checkEmptyValue()

    if(key === 'shift+left') {
      EditorActions.selectionLeft()
    } else if(key === 'shift+right') {
      EditorActions.selectionRight()
    } else if(key === 'shift+up') {
      EditorActions.selectionUp()
    } else if(key === 'shift+down') {
      EditorActions.selectionDown()
    }
    return false
  },

  _handleKeyBackspace() {
    this._checkEmptyValue()

    EditorActions.eraseCharBack()
    return false
  },

  _handleKeyDelete() {
    this._checkEmptyValue()

    EditorActions.eraseCharForward()
    return false
  },

  _handleKeyWordBackspace() {
    this._checkEmptyValue()

    EditorActions.eraseWordBack()
    return false
  },

  _handleKeyWordDelete() {
    this._checkEmptyValue()

    EditorActions.eraseWordForward()
    return false
  },

  _handleKeyEnter() {
    this._checkEmptyValue()

    EditorActions.insertChars('\n')
    return false
  },

  _handleKeyNavigationPage(e, key) {
    if(key === 'pageup') {
      EditorActions.navigatePageUp()
    } else if(key === 'pagedown') {
      EditorActions.navigatePageDown()
    }
    return false
  },

  _handleKeySelectionPage(e, key) {
    if(key === 'shift+pageup') {
      EditorActions.selectionPageUp()
    } else if(key === 'shift+pagedown') {
      EditorActions.selectionPageDown()
    }
    return false
  },

  _handleKeyNavigationHomeEnd(e, key) {
    if(key === 'ctrl+home') {
      EditorActions.navigateStart()
    } else if(key === 'home') {
      EditorActions.navigateStartLine()
    } else if(key === 'ctrl+end') {
      EditorActions.navigateEnd()
    } else if(key === 'end') {
      EditorActions.navigateEndLine()
    }
    return false
  },

  _handleKeyNavigationWord(e, key) {
    this._checkEmptyValue()

    if(key === 'ctrl+left') {
      EditorActions.navigateWordLeft()
    } else if(key === 'ctrl+right') {
      EditorActions.navigateWordRight()
    }
    return false
  },

  _handleKeySelectionHomeEnd(e, key) {
    if(key === 'ctrl+shift+home') {
      EditorActions.selectionStart()
    } else if(key === 'shift+home') {
      EditorActions.selectionStartLine()
    } else if(key === 'ctrl+shift+end') {
      EditorActions.selectionEnd()
    } else if(key === 'shift+end') {
      EditorActions.selectionEndLine()
    }

    return false
  },

  _handleKeySelectionWord(e, key) {
    if(key === 'shift+ctrl+left') {
      EditorActions.selectionWordLeft()
    } else if(key === 'shift+ctrl+right') {
      EditorActions.selectionWordRight()
    }
    return false
  },

  _handleKeySelectionAll() {
    EditorActions.selectionAll()
    return false
  },

  _handleKeyBold() {
    EditorActions.toggleBold()
    return false
  },

  _handleKeyItalics() {
    EditorActions.toggleItalics()
    return false
  },

  _handleKeyUnderline() {
    EditorActions.toggleUnderline()
    return false
  },

  _handleKeyStrikethrough() {
    EditorActions.toggleStrikethrough()
    return false
  },

  _handleKeySuperscript() {
    EditorActions.toggleSuperscript()
    return false
  },

  _handleKeySubscript() {
    EditorActions.toggleSubscript()
    return false
  },

  _onInputFocusLost() {
    if(!this.ieClipboardDivFocus) {
      EditorActions.inputFocusLost()
    }
  },

  _onCopy(e) {
    let copyHandler = window.clipboardData ?
      _.partial(this._handleIeCopy) :
      _.partial(this._handleNormalCopy, e)

    EditorActions.copySelection(copyHandler)
  },

  _onCut(e) {
    this._onCopy(e)
    EditorActions.eraseSelection()
  },

  _handleNormalCopy(e, copiedText, copiedHtml, copiedRich) {
    e.clipboardData.setData(MIME_TYPE_TEXT_PLAIN, copiedText)
    e.clipboardData.setData(MIME_TYPE_TEXT_HTML, copiedHtml)
    // some browsers e.g. Chrome support arbitrary MIME types, makes paste way more efficient
    // Firefox allows setting the type, but not pasting it -- see https://bugzilla.mozilla.org/show_bug.cgi?id=860857
    e.clipboardData.setData(MIME_TYPE_RITZY_RICH_TEXT, JSON.stringify(copiedRich))
    e.preventDefault()
    e.stopPropagation()
  },

  _handleIeCopy(copiedText, copiedHtml) {
    window.clipboardData.setData('Text', copiedText)
    this.ieClipboardDiv.innerHTML = copiedHtml
    this._focusIeClipboardDiv()
    this._selectIeClipboardDivContents()
    setTimeout(() => {
      emptyNode(this.ieClipboardDiv)
      this._focus()
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
      EditorActions.insertCharsBatch(JSON.parse(pasted))
    } else if(clipboardDataTypes.findIndex(t => t === MIME_TYPE_TEXT_HTML) > -1) {
      let pasted = e.clipboardData.getData(MIME_TYPE_TEXT_HTML)
      let pastedChunks = parseHtml(pasted, this.hiddenContainer)
      EditorActions.insertCharsBatch(pastedChunks)
    } else if(clipboardDataTypes.findIndex(t => t === MIME_TYPE_TEXT_PLAIN) > -1) {
      let pasted = e.clipboardData.getData(MIME_TYPE_TEXT_PLAIN)
      EditorActions.insertChars(pasted)
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
        EditorActions.insertCharsBatch(pastedChunks)
      } finally {
        emptyNode(this.ieClipboardDiv)
        this._focus()
      }
    }, 0)
  },

  _focusIeClipboardDiv() {
    this.ieClipboardDivFocus = true
    this.ieClipboardDiv.focus()
  },

  _selectIeClipboardDivContents() {
    let range = document.createRange()
    range.selectNodeContents(this.ieClipboardDiv)
    let selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  },

  _onInput(e) {
    // catch inputs that our keyboard handler doesn't catch e.g. compose key, IME inputs, etc.
    let value = e.target.value
    EditorActions.insertChars(value)
    this._focus()
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
          onCopy={this._onCopy} onCut={this._onCut} onPaste={this._onPaste} onBlur={this._onInputFocusLost}/>
        <div style={{display: 'none'}} ref="hiddenContainer"></div>
        <div contentEditable="true" ref="ieClipboardDiv" onPaste={this._onPaste}></div>
      </div>
    )
  }

})

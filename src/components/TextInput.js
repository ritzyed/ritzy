import React from 'react/addons'
import getEventKey from 'react/lib/getEventKey'
import Mousetrap from 'mousetrap'

const batchedUpdates = React.addons.batchedUpdates
const T = React.PropTypes

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
    insertChars: T.func.isRequired,
    navigateLeft: T.func.isRequired,
    navigateRight: T.func.isRequired,
    navigateUp: T.func.isRequired,
    navigateDown: T.func.isRequired,
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
    selectionStart: T.func.isRequired,
    selectionStartLine: T.func.isRequired,
    selectionEnd: T.func.isRequired,
    selectionEndLine: T.func.isRequired,
    selectionWordLeft: T.func.isRequired,
    selectionWordRight: T.func.isRequired,
    eraseCharBack: T.func.isRequired,
    eraseCharForward: T.func.isRequired,
    eraseWordBack: T.func.isRequired,
    eraseWordForward: T.func.isRequired,
    toggleBold: T.func.isRequired,
    toggleItalics: T.func.isRequired,
    toggleUnderline: T.func.isRequired,
    toggleStrikethrough: T.func.isRequired,
    toggleSuperscript: T.func.isRequired,
    toggleSubscript: T.func.isRequired
  },

  //mixins: [React.addons.PureRenderMixin],

  componentDidMount() {
    // React does not batch setState calls inside events raised by mousetrap, create a wrapper to do that
    let keyBindingsReal = new Mousetrap(React.findDOMNode(this.refs.input))

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
    keyBindings.bind(['ctrl+home', 'home', 'ctrl+end', 'end'], this._handleKeyNavigationHomeEnd)
    keyBindings.bind(['ctrl+shift+home', 'shift+home', 'ctrl+shift+end', 'shift+end'], this._handleKeySelectionHomeEnd)
    keyBindings.bind(['ctrl+left', 'ctrl+right'], this._handleKeyNavigationWord)
    keyBindings.bind(['shift+ctrl+left', 'shift+ctrl+right'], this._handleKeySelectionWord)
    keyBindings.bind('backspace', this._handleKeyBackspace)
    keyBindings.bind('del', this._handleKeyDelete)
    keyBindings.bind('ctrl+backspace', this._handleKeyWordBackspace)
    keyBindings.bind('ctrl+del', this._handleKeyWordDelete)
    //keyBindings.bind('ctrl+s', this._handleKeySave)
    //keyBindings.bind(['ctrl+c', 'ctrl+ins'], this._handleKeyCopy)
    //keyBindings.bind(['ctrl+v', 'shift+ins'], this._handleKeyPaste)
    //keyBindings.bind('tab', this._handleKeyTab)
    keyBindings.bind('enter', this._handleKeyEnter)
    //keyBindings.bind(['pageup', 'pagedown'], this._handleKeyPage)
    //keyBindings.bind(['ctrl+home', 'ctrl+end'], this._handleKeyNavigationCtrlHomeEnd)
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

  shouldComponentUpdate() {
    // invisible component, we don't need to update it
    return false
  },

  focus() {
    React.findDOMNode(this.refs.input).focus()
  },

  _checkEmptyValue() {
    let value = React.findDOMNode(this.refs.input).value
    if(value.length > 0) {
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

  _onPaste(e) {
    this._checkEmptyValue()

    if(e.clipboardData.types.filter((t) => { return t === 'text/plain' }).length > 0) {
      let pasted = e.clipboardData.getData('text/plain')
      this.props.insertChars(pasted)
    } else {
      console.warn('Paste not supported yet for types: ' + JSON.stringify(e.clipboardData.types))
    }

    e.preventDefault()
    e.stopPropagation()
  },

  _onInput(e) {
    // catch inputs that our keyboard handler doesn't catch e.g. compose key, IME inputs, etc.
    let value = e.target.value
    e.target.value = ''
    this.props.insertChars(value)
  },

  // TODO hide the text area and move it along with the cursor (and keep focus on it)
  render() {
    return (
      <div style={{overflow: 'hidden', height: 0}}>
        <textarea className="text-inputarea" key="input" ref="input" onPaste={this._onPaste} onInput={this._onInput}/>
      </div>
    )
  }

})

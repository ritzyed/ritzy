import 'babel/polyfill'

import React from 'react/addons'
import invariant from 'react/lib/invariant'
import _ from 'lodash'
import classNames from 'classnames'

import { BASE_CHAR } from 'RichText'
import { elementPosition } from 'dom'
import { pushArray } from 'utils'
import { default as tokenizer, isWhitespace } from 'tokenizer'
import TextReplicaMixin from './TextReplicaMixin'
import TextFontMetricsMixin from './TextFontMetricsMixin'
import TextInput from './TextInput'
import {ATTR, hasAttributeFor, attributesEqual} from './attributes'

// TODO do this as a require or just make it part of the js or make it global?
require('text.less')

const T = React.PropTypes
const nbsp = String.fromCharCode(160)

export default React.createClass({
  propTypes: {
    id: T.number.isRequired,
    fonts: T.shape({
      regular: T.object,
      bold: T.object,
      boldItalic: T.object,
      italic: T.object
    }),
    fontSize: T.number.isRequired,
    minFontSize: T.number.isRequired,
    unitsPerEm: T.number.isRequired,
    margin: T.number.isRequired,
    width: T.number.isRequired
  },

  mixins: [TextReplicaMixin, TextFontMetricsMixin],

  getInitialState() {
    return {
      position: BASE_CHAR,
      cursorMotion: false,
      selectionActive: false
    }
  },

  componentWillMount() {
    this._createReplica()

    this.inputFunctions = {
      insertChars: this.insertChars,
      navigateLeft: this.navigateLeft,
      navigateRight: this.navigateRight,
      navigateUp: this.navigateUp,
      navigateDown: this.navigateDown,
      navigateStart: this.navigateStart,
      navigateStartLine: this.navigateStartLine,
      navigateEnd: this.navigateEnd,
      navigateEndLine: this.navigateEndLine,
      navigateWordLeft: this.navigateWordLeft,
      navigateWordRight: this.navigateWordRight,
      selectionLeft: this.selectionLeft,
      selectionRight: this.selectionRight,
      selectionUp: this.selectionUp,
      selectionDown: this.selectionDown,
      selectionStart: this.selectionStart,
      selectionStartLine: this.selectionStartLine,
      selectionEnd: this.selectionEnd,
      selectionEndLine: this.selectionEndLine,
      selectionWordLeft: this.selectionWordLeft,
      selectionWordRight: this.selectionWordRight,
      eraseCharBack: this.eraseCharBack,
      eraseCharForward: this.eraseCharForward,
      eraseWordBack: this.eraseWordBack,
      eraseWordForward: this.eraseWordForward,
      toggleBold: this.toggleBold,
      toggleItalics: this.toggleItalics,
      toggleUnderline: this.toggleUnderline,
      toggleStrikethrough: this.toggleStrikethrough,
      toggleSuperscript: this.toggleSuperscript,
      toggleSubscript: this.toggleSubscript
    }
  },

  componentDidMount() {
    this.clickCount = 0
    this.activeAttributes = null
    this.upDownAdvanceX = null
    this.upDownPositionEolStart = null
    this.paragraphContainer = React.findDOMNode(this.refs.paragraphContainer)

    this.flow()
  },

  /**
   * Sets the character and cursor position within the paragraph text. The position
   * is relative to an existing character given by its replica id. The cursor position is
   * calculated based on the character position. This is generally straightforward except when
   * the character position is the last character of a line. In this situation, there are two
   * possible cursor positions: at the end of the line, or at the beginning of the next line. The
   * desired cursor location depends on how one got there e.g. hitting "end" on a line should keep
   * you on the same line, hitting "home" on the next line takes you to the same character position,
   * except at the beginning of that line.
   *
   * @param {object} position The character position to set.
   * @param {boolean} [positionEolStart = true] positionEolStart When rendering the cursor, this state
   *   determines the cursor position when the character position is at a line end: whether to place
   *   the cursor at the start of the next line (positionEolStart = true), or at the end of the
   *   current one (positionEolStart = false). If the cursor position is not at a line end, this state
   *   is ignored by the renderer.
   */
  setPosition(position, positionEolStart) {
    if(_.isUndefined(positionEolStart)) positionEolStart = true

    this.setState({
      position: position,
      positionEolStart: positionEolStart,
      selectionActive: false
    })

    this.activeAttributes = null
    this.upDownAdvanceX = null
    this.upDownPositionEolStart = null
    this.refs.input.focus()
    this._delayedCursorBlink()
  },

  resetPosition() {
    this.setPosition(BASE_CHAR)
  },

  /**
   * Flows the paragraph i.e. wraps the text into multiple lines, splits each line into chunks with the same
   * attributes, and sets the component state based on the result. This state is then used for rendering the
   * editor surface during the next render cycle. This should be called after any operation that may change
   * the paragraph flow, such as inserting or deleting text.
   *
   * One or more spaces at the end of a word are not "counted" for wrapping purposes because that would cause the
   * space to show up at the beginning of the next line. Instead, these spaces are included on the prior line
   * even though strictly it causes the line length to exceed the margin. This behavior is consistent with
   * common word processors such as Microsoft Word and Google Docs.
   *
   * Even though all of the state here can be calculated from the replica, this is not done at render time
   * because the line state must be available when user input such as clicks or selections are made.
   * TODO Alternatively, consider just running this algorithm each time the lines/chunks are needed?
   */
  flow() {
    let lines = []
    let currentWord = {
      chars: [],
      pendingChunks: [],
      advance: 0,
      lineAdvance: 0,
      attributes: null,
      fontSize: null,
      lastCharSpace: false,

      reset() {
        this.chars = []
        this.pendingChunks = []
        this.advance = 0
        this.lineAdvance = 0
        this.attributes = null
        this.fontSize = null
        this.lastCharSpace = false
      },

      pushChar(c, thisRef) {
        if(!this.attributes) {
          this.attributes = c.attributes
        }
        if(!this.fontSize) {
          this.fontSize = thisRef.fontSizeFromAttributes(thisRef.props.fontSize, this.attributes)
        }
        let charAdvance = thisRef.advanceXForChars(this.fontSize, c)

        // don't count spaces in the word in the advance, but include it in the line advance
        if(c.char === ' ') {
          this.lastCharSpace = true
        } else {
          this.advance += charAdvance
        }
        this.lineAdvance += charAdvance
        this.chars.push(c)
      },

      popChar() {
        return this.chars.pop()
      },

      pushChunks() {
        if(this.chars.length > 0) {
          this.pendingChunks.push({
            text: this.chars,
            attributes: this.attributes
          })
        }
        this.chars = []
        this.attributes = null
        this.fontSize = null
      }
    }

    let currentLine = {
      chunks: [],
      advance: 0,

      reset() {
        this.chunks = []
        this.advance = 0
      },

      pushWord(word) {
        invariant(word.chars.length === 0, 'Must complete word before pushing.')
        if(word.pendingChunks.length > 0) {
          // if the last chunk in the line matches attributes with the first word chunk, join them to avoid extra spans
          if(this.chunks.length > 0
            && attributesEqual(this.chunks[this.chunks.length - 1].attributes, word.pendingChunks[0].attributes)) {
            pushArray(this.chunks[this.chunks.length - 1].text, word.pendingChunks[0].text)
            word.pendingChunks.shift()
          }

          pushArray(this.chunks, word.pendingChunks)
        }
        this.advance += word.lineAdvance
        word.reset()
      }
    }

    let pushLine = (line) => {
      if(line.chunks.length > 0) {
        // the "start" of a line is the last character of the previous line, or the BASE_CHAR if the first line
        let start = lines.length > 0 ? lines[lines.length - 1].end : BASE_CHAR
        let lastChunk = line.chunks[line.chunks.length - 1]
        let end = lastChunk.text[lastChunk.text.length - 1]
        lines.push({
          chunks: line.chunks,
          start: start,
          end: end
        })
      }
      line.reset()
    }

    let lineWidth = this.props.width - (this.props.margin * 2)

    let processChar = (c) => {
      if (!attributesEqual(currentWord.attributes, c.attributes)) {
        currentWord.pushChunks()
      }

      if(c.char !== ' ' && currentWord.lastCharSpace) {
        // new word
        currentWord.pushChunks()
        currentLine.pushWord(currentWord)
      }

      currentWord.pushChar(c, this)

      // check for line wrap
      if(currentLine.advance === 0 && currentWord.advance > lineWidth) {
        // word longer than a line, here we need to remove the last char to get us back under the line width
        let lastChar = currentWord.popChar()
        currentWord.pushChunks()
        currentLine.pushWord(currentWord)
        pushLine(currentLine)
        processChar(lastChar)
      } else if (currentLine.advance + currentWord.advance > lineWidth) {
        pushLine(currentLine)
      }
    }

    let contentIterator = this.replica.getTextRange(BASE_CHAR)[Symbol.iterator]()
    let e
    while(!(e = contentIterator.next()).done) {
      processChar(e.value)
    }

    currentWord.pushChunks()
    currentLine.pushWord(currentWord)
    pushLine(currentLine)

    this.setState({lines: lines})
  },

  insertChars(value) {
    let position = this.state.position

    if(this.state.selectionActive) {
      position = this.state.selectionLeftChar
      // if selection, then activeAttributes (set by command or toolbar) are set by the first selected char
      this.activeAttributes = this.relativeChar(position, 1, 'limit').attributes || {}
      this._eraseSelection()
    }

    let attributes = this.activeAttributes ?
      this.activeAttributes :
      this.relativeChar(position, 0).attributes // reload attributes from the replica in case they have changed

    this.replica.insertCharsAt(position, value, attributes)

    let relativeMove = value.length
    this.setPosition(this.relativeChar(position, relativeMove), false)
    this.flow()
  },

  navigateLeft() {
    this._navigateLeftRight(-1)
  },

  navigateRight() {
    this._navigateLeftRight(1)
  },

  navigateUp() {
    this._navigateUpDown(-1)
  },

  navigateDown() {
    this._navigateUpDown(1)
  },

  navigateStart() {
    this.setPosition(BASE_CHAR)
  },

  navigateStartLine() {
    let {line} = this._lineContainingChar(this.state.position, this.state.positionEolStart)
    this.setPosition(line.start)
  },

  navigateEnd() {
    this.setPosition(this.relativeChar(BASE_CHAR, -1), false)
  },

  navigateEndLine() {
    let {line} = this._lineContainingChar(this.state.position, this.state.positionEolStart)
    this.setPosition(line.end, false)
  },

  navigateWordLeft() {
    let position
    if(this.state.selectionActive) {
      // start from one character into the selection left char so that relative to the left selected word
      position = this.relativeChar(this.state.selectionLeftChar, 1, 'limit')
    } else {
      position = this.state.position
    }
    this.setPosition(this._wordStartRelativeTo(position))
  },

  navigateWordRight() {
    let position
    if(this.state.selectionActive) {
      // start from one character before the selection right char so that relative to the right selected word
      position = this.relativeChar(this.state.selectionRightChar, -1, 'limit')
    } else {
      position = this.state.position
    }
    this.setPosition(this._wordEndRelativeTo(position))
  },

  selectionLeft() {
    this._modifySelection(this.relativeChar(this.state.position, -1, 'limit'))
  },

  selectionRight() {
    this._modifySelection(this.relativeChar(this.state.position, 1, 'limit'))
  },

  selectionUp() {
    this._selectionUpDown(-1)
  },

  selectionDown() {
    this._selectionUpDown(1)
  },

  selectionStart() {
    this._modifySelection(BASE_CHAR)
  },

  selectionStartLine() {
    let {line} = this._lineContainingChar(this.state.position, this.state.positionEolStart)
    this._modifySelection(line.start)
  },

  selectionEnd() {
    this._modifySelection(this.relativeChar(BASE_CHAR, -1))
  },

  selectionEndLine() {
    let {line} = this._lineContainingChar(this.state.position, this.state.positionEolStart)
    this._modifySelection(line.end, false)
  },

  selectionWordLeft() {
    this._modifySelection(this._wordStartRelativeTo(this.state.position))
  },

  selectionWordRight() {
    this._modifySelection(this._wordEndRelativeTo(this.state.position))
  },

  eraseCharBack() {
    let position = this.state.position
    if(this.state.selectionActive) {
      position = this.state.selectionLeftChar
      this._eraseSelection()
      this.setPosition(position)
    } else {
      position = this.relativeChar(position, -1)
      this.replica.rmChars(this.state.position)
    }
    this.flow()
  },

  eraseCharForward() {
    if(this.state.selectionActive) {
      let position = this.state.selectionLeftChar
      this._eraseSelection()
      this.setPosition(position)
    } else {
      let next = this.relativeChar(this.state.position, 1)
      this.replica.rmChars(next)
    }
    this.flow()
  },

  eraseWordBack() {
    let position = this.state.position
    if(this.state.selectionActive) {
      position = this.state.selectionLeftChar
      this._eraseSelection()
      this.setPosition(position)
    } else {
      let start = this._wordStartRelativeTo(position)
      let end = position
      if(start.id === position.id) {
        // beginning of word, move to the previous word
        let previousStart = this._wordStartRelativeTo(this.relativeChar(position, -1, 'limit'))
        // no previous word, nothing to delete
        if(start === previousStart) return
        end = this._wordEndRelativeTo(start)
      }

      // TODO delete at beginning of line deletes last word on previous line or last word of previous paragraph

      let wordChars = this.replica.getTextRange(start, end)
      this.replica.rmChars(wordChars)
    }
    this.flow()
  },

  eraseWordForward() {
    let position = this.state.position
    if(this.state.selectionActive) {
      position = this.state.selectionLeftChar
      this._eraseSelection()
      this.setPosition(position)
    } else {
      let options
      if(isWhitespace(this.relativeChar(position, 1, 'limit').char)) {
        options = { includeLeadingSpace: true }
      }
      let start = position
      let end = this._wordEndRelativeTo(start, options)
      if(end.id === position.id) {
        // ending of word, move to the next word
        let nextEnd = this._wordEndRelativeTo(this.relativeChar(position, 1, 'limit'), options)
        // no next word, nothing to delete
        if(end === nextEnd) return
        start = this._wordStartRelativeTo(end, options)
      }

      // TODO delete at end of line deletes first word on next line or first word of next paragraph

      let wordChars = this.replica.getTextRange(start, end)
      this.replica.rmChars(wordChars)
    }
    this.flow()
  },

  toggleBold() {
    this._toggleAttribute(ATTR.BOLD)
  },

  toggleItalics() {
    this._toggleAttribute(ATTR.ITALIC)
  },

  toggleUnderline() {
    this._toggleAttribute(ATTR.UNDERLINE)
  },

  toggleStrikethrough() {
    this._toggleAttribute(ATTR.STRIKETHROUGH)
  },

  toggleSuperscript() {
    this._toggleAttribute(ATTR.SUPERSCRIPT, ATTR.SUBSCRIPT)
  },

  toggleSubscript() {
    this._toggleAttribute(ATTR.SUBSCRIPT, ATTR.SUPERSCRIPT)
  },

  _createReplica() {
    this.createTextReplica(this.props.id)
    this.registerCb(this._replicaInitCb, this._replicaUpdateCb)

    // TODO get user information?
    this.localuser = window.localStorage.getItem('localuser')
  },

  _replicaInitCb(spec, op, replica) {  // eslint-disable-line no-unused-vars
    // set our own replica for future use
    this.replicaSource = this.sourceOf(spec)
    this.flow()
  },

  _replicaUpdateCb(spec, op, replica) {  // eslint-disable-line no-unused-vars
    if(this.replicaSource === this.sourceOf(spec)) return
    this.flow()
  },

  _delayedCursorBlink() {
    this.setState({cursorMotion: true})

    // in a second, reset the cursor blink, clear any previous resets to avoid unnecessary state changes
    if(this.cursorMotionTimeout) {
      clearTimeout(this.cursorMotionTimeout)
    }
    this.cursorMotionTimeout = setTimeout(() => {
      this.setState({cursorMotion: false})
      this.cursorMotionTimeout = null
    }, 1000)
  },

  _modifySelection(toChar, positionEolStart) {
    if(!toChar) return

    this.setState((previousState) => {
      if(previousState.selectionActive) {
        if(previousState.selectionAnchorChar.id === previousState.selectionLeftChar.id) {
          let compareAnchorPos = this.replica.compareCharPos(toChar, previousState.selectionAnchorChar)
          if(compareAnchorPos < 0) {
            return {
              selectionRightChar: previousState.selectionAnchorChar,
              selectionLeftChar: toChar,
              position: toChar,
              positionEolStart: true
            }
          } else if(compareAnchorPos > 0) {
            return {
              selectionRightChar: toChar,
              position: toChar,
              positionEolStart: false
            }
          } else {
            this.setPosition(previousState.selectionAnchorChar, positionEolStart)
          }
        } else {
          let compareAnchorPos = this.replica.compareCharPos(previousState.selectionAnchorChar, toChar)
          if(compareAnchorPos < 0) {
            return {
              selectionRightChar: toChar,
              selectionLeftChar: previousState.selectionAnchorChar,
              position: toChar,
              positionEolStart: false
            }
          } else if(compareAnchorPos > 0) {
            return {
              selectionLeftChar: toChar,
              position: toChar,
              positionEolStart: true
            }
          } else {
            this.setPosition(previousState.selectionAnchorChar, positionEolStart)
          }
        }
      } else {
        let comparePos = this.replica.compareCharPos(previousState.position, toChar)
        if(comparePos === 0) return null
        return {
          selectionActive: true,
          selectionAnchorChar: previousState.position,
          selectionLeftChar: comparePos < 0 ? previousState.position : toChar,
          selectionRightChar: comparePos > 0 ? previousState.position : toChar,
          position: toChar,
          positionEolStart: comparePos > 0
        }
      }
      // TODO toolbar state based on common rich text attributes of selection
    })
    this.upDownAdvanceX = null
    this.upDownPositionEolStart = null
  },

  _charPositionRelativeToIndex(charIndex, textChars) {
    if(charIndex === 0) {
      return this.relativeChar(textChars[0], -1)
    } else {
      return textChars[charIndex - 1]
    }
  },

  _wordRelativeTo(char, options) {
    let textChars = this.replica.getTextRange(BASE_CHAR)
    let charIndex = textChars.findIndex(e => e.id === char.id) + 1
    let tokenRanges = tokenizer(textChars.map(c => c.char), options)
    for(let i = 0; i < tokenRanges.length; i++) {
      if(charIndex >= tokenRanges[i].start && charIndex < tokenRanges[i].end) {
        return {
          start: tokenRanges[i].start === 0 ? BASE_CHAR : textChars[tokenRanges[i].start - 1],
          end: textChars[tokenRanges[i].end - 1]
        }
      }
    }
    // if charIndex == last token range end
    let last = tokenRanges.length - 1
    return {
      start: tokenRanges[last].start === 0 ? BASE_CHAR : textChars[tokenRanges[last].start - 1],
      end: textChars[tokenRanges[last].end - 1]
    }
  },

  _wordStartRelativeTo(char, options) {
    let textChars = this.replica.getTextRange(BASE_CHAR, char)
    let tokenRanges = tokenizer(textChars.map(c => c.char), options)
    if(tokenRanges.length > 0) {
      let start = tokenRanges[tokenRanges.length - 1].start
      return start < 1 ? BASE_CHAR : textChars[start - 1]
    } else {
      return BASE_CHAR
    }
  },

  _wordEndRelativeTo(char, options) {
    let textChars = this.replica.getTextRange(char)
    let tokenRanges = tokenizer(textChars.map(c => c.char), options)
    if(tokenRanges.length > 0) {
      let end = tokenRanges[0].end
      return textChars[end - 1]
    } else {
      return this.relativeChar(BASE_CHAR, -1)
    }
  },

  _mouseEventToPositionAndCursorX(e) {
    // the entire target span is a particular weight and style, so we can calculate our font metrics relative to it
    let mouseX = e.pageX - elementPosition(e.target).x
    // TODO handle mouse position outside elements containing text (could be before or after) with the whole text
    // TODO do we still need id or can we use the lines state?
    let textChars = e.target.id ?
      this.replica.getTextRange(this.relativeChar(e.target.id, -1, 'limit')) :
      this.replica.getTextRange(BASE_CHAR)

    let indexAndCursor = this.indexAndCursorForXValue(this.props.fontSize, mouseX, textChars)
    let position = this._charPositionRelativeToIndex(indexAndCursor.index, textChars)
    // note that the cursorX is relative to the target span, not the beginning of the text
    return {
      position: position,
      cursorX: indexAndCursor.cursorX
    }
  },

  _mouseEventToPosition(e) {
    return this._mouseEventToPositionAndCursorX(e).position
  },

  _doOnSingleClick(e) {
    // hack: if the user clicks on their own cursor sometimes that becomes the target element
    // this is for browsers that don't support pointer-events: none, like IE < 11
    if(e.target.className.indexOf('text-cursor-caret') >= 0) {
      return
    }

    // save the position for a potential double-click
    let {position, cursorX} = this._mouseEventToPositionAndCursorX(e)
    this.savedPosition = position

    if(e.shiftKey) {
      this._modifySelection(position)
    } else {
      // set the position and selection anchor if the user continues the selection later
      position = position ? position : BASE_CHAR

      // if clicked a line beginning (char position is end of last line) then position beginning of clicked line
      let positionEolStart = cursorX === 0
      this.setPosition(position, positionEolStart)
      this.setState({
        selectionAnchorChar: position
      })
    }
  },

  _doOnDoubleClick() {
    if(!this.savedPosition) return

    let word = this._wordRelativeTo(this.savedPosition)

    this.setState({
      selectionActive: true,
      selectionAnchorChar: word.start,
      selectionLeftChar: word.start,
      selectionRightChar: word.end,
      position: word.end,
      positionEolStart: false
    })
  },

  _onMouseDown(e) {
    if(this.clickReset) {
      clearTimeout(this.clickReset)
      this.clickReset = null
    }
    let clickCount = this.clickCount
    this.clickCount += 1
    this.clickReset = setTimeout(() => {
      this.clickCount = 0
    }, 250)

    if(clickCount === 0) {
      this._doOnSingleClick(e)
    } else if (clickCount === 1) {
      // note that _doOnSingleClick has already executed here
      this._doOnDoubleClick(e)
    } //else if(this.clickCount === 2) // TODO handle triple-click

    e.preventDefault()
    e.stopPropagation()
  },

  _onMouseMove(e) {
    if(e.buttons !== 1) return

    // hack: if we're rolling over our own cursor do nothing, otherwise the element position goes to 0
    // this is for browsers that don't support pointer-events: none, like IE < 11
    if(e.target.className.indexOf('text-cursor-caret') >= 0) {
      return
    }

    let position = this._mouseEventToPosition(e)

    if(position) {
      this._modifySelection(position)
    }

    e.preventDefault()
    e.stopPropagation()
  },

  _eraseSelection() {
    invariant(this.state.selectionActive, 'Selection must be active to erase it.')
    let selectionChars = this.replica.getTextRange(this.state.selectionLeftChar, this.state.selectionRightChar)
    this.replica.rmChars(selectionChars)
    this.setState({selectionActive: false})
  },

  _navigateLeftRight(charCount) {
    let position
    if(this.state.selectionActive && charCount < 0) {
      // left from left anchor
      position = this.state.selectionLeftChar
    } else if(this.state.selectionActive) {
      // right from right anchor
      position = this.state.selectionRightChar
    } else {
      position = this.relativeChar(this.state.position, charCount, 'limit')
    }
    this.setPosition(position)
  },

  _navigateUpDown(lineCount) {
    let position
    let positionEolStart = this.state.positionEolStart
    if(this.state.selectionActive && lineCount < 0) {
      // up from left char
      position = this.state.selectionLeftChar
      positionEolStart = true
    } else if(this.state.selectionActive) {
      // down from right char
      position = this.state.selectionRightChar
      positionEolStart = false
    } else {
      position = this.state.position
    }

    let {line, index, endOfLine} = this._lineContainingChar(position, positionEolStart)
    let upDownAdvanceX = this.upDownAdvanceX
    if(upDownAdvanceX == null) {
      if(position.id === BASE_CHAR.id || (endOfLine && positionEolStart)) {
        upDownAdvanceX = 0
        positionEolStart = true
      } else {
        let chars = this.replica.getTextRange(line.start, position)
        upDownAdvanceX = this.advanceXForChars(this.props.fontSize, chars)
        positionEolStart = false
      }
    }
    if(index + lineCount < 0 || index + lineCount > this.state.lines.length - 1) {
      // nowhere to go, just unblink for a second to indicate to the user input was received
      this._delayedCursorBlink()
    } else {
      let targetLine = this.state.lines[index + lineCount]
      let chars = this.replica.getTextRange(targetLine.start, targetLine.end)
      let indexAndCursor = this.indexAndCursorForXValue(this.props.fontSize, upDownAdvanceX, chars)
      let newPosition = this._charPositionRelativeToIndex(indexAndCursor.index, chars)
      this.setPosition(newPosition, positionEolStart)
    }
    // save the advance in case the user navigates up or down again
    this.upDownAdvanceX = upDownAdvanceX
  },

  _selectionUpDown(lineCount) {
    let position = this.state.position
    let positionEolStart = this.upDownPositionEolStart ? this.upDownPositionEolStart : this.state.positionEolStart

    let {line, index, endOfLine} = this._lineContainingChar(position, positionEolStart)

    let upDownAdvanceX = this.upDownAdvanceX
    if(upDownAdvanceX == null) {
      if(position.id === BASE_CHAR.id || (endOfLine && positionEolStart)) {
        upDownAdvanceX = 0
        positionEolStart = true
      } else {
        let chars = this.replica.getTextRange(line.start, position)
        upDownAdvanceX = this.advanceXForChars(this.props.fontSize, chars)
        positionEolStart = false
      }
    }
    if(index + lineCount < 0) {
      this._modifySelection(BASE_CHAR)
      // at start of first line, reset the advanceX, and positionEolStart is now true
      upDownAdvanceX = 0
      positionEolStart = true
    } else if(index + lineCount > this.state.lines.length - 1) {
      this._modifySelection(this.relativeChar(BASE_CHAR, -1))
      // at end of last line, reset the advanceX, and positionEolStart is now false
      upDownAdvanceX = null
      positionEolStart = false
    } else {
      let targetLine = this.state.lines[index + lineCount]
      let chars = this.replica.getTextRange(targetLine.start, targetLine.end)
      let indexAndCursor = this.indexAndCursorForXValue(this.props.fontSize, upDownAdvanceX, chars)
      let newPosition = this._charPositionRelativeToIndex(indexAndCursor.index, chars)
      this._modifySelection(newPosition, positionEolStart)
    }
    // save the advance in case the user navigates up or down again
    this.upDownAdvanceX = upDownAdvanceX
    this.upDownPositionEolStart = positionEolStart
  },

  _toggleAttribute(attribute, exclusiveWith) {
    if(this.state.selectionActive) {
      let selectionChars = this.replica.getTextRange(this.state.selectionLeftChar, this.state.selectionRightChar)
      let charsWithAttrNotSet = selectionChars.filter(c => !c.attributes || !c.attributes[attribute])
      let attrNeedsSet = charsWithAttrNotSet && charsWithAttrNotSet.length > 0

      let setAttr = {}

      if(attrNeedsSet) {
        let attr = {}
        attr[attribute] = true
        attr[exclusiveWith] = false

        for(let i = 0; i < charsWithAttrNotSet.length; i++) {
          let currentAttrs = charsWithAttrNotSet[i].attributes
          setAttr[charsWithAttrNotSet[i].id] = currentAttrs ? _.merge(currentAttrs, attr) : attr
        }
      } else {
        for(let i = 0; i < selectionChars.length; i++) {
          let currentAttrs = selectionChars[i].attributes
          delete currentAttrs[attribute]
          setAttr[selectionChars[i].id] = currentAttrs
        }
      }

      this.replica.setAttributes(setAttr)
      this.flow()
    } else {
      // TODO set the state of the toolbar so the toolbar button can be rendered accordingly
      // no selection so we are either toggling the explicitly set state, or setting the state explicitly
      if(this.activeAttributes) {
        this.activeAttributes[attribute] = !this.activeAttributes[attribute]
        if(this.activeAttributes[attribute] && this.activeAttributes[exclusiveWith]) {
          this.activeAttributes[exclusiveWith] = false
        }
      } else if(this.state.position) {
        let currentAttrs = this.relativeChar(this.state.position, 0, 'limit').attributes
        if(currentAttrs) {
          currentAttrs[attribute] = !currentAttrs[attribute]
          this.activeAttributes = currentAttrs
          if(this.activeAttributes[attribute] && this.activeAttributes[exclusiveWith]) {
            this.activeAttributes[exclusiveWith] = false
          }
        } else {
          this.activeAttributes = {}
          this.activeAttributes[attribute] = true
        }
      }
    }
  },

  _lineContainingChar(char, nextIfEol) {
    invariant(this.state.lines, 'Lines must be defined in the state.')
    if(_.isUndefined(nextIfEol)) nextIfEol = false
    for(let i = 0; i < this.state.lines.length; i++) {
      // make this a binary search for performance with large paragraphs?
      let compareCharPos = this.replica.compareCharPos(char, this.state.lines[i].end)
      if(compareCharPos <= 0) {
        let endOfLine = compareCharPos === 0
        let index = i
        if(nextIfEol && endOfLine) {
          index = this.state.lines.length - 1 > index ? index + 1 : index
        }
        return {
          line: this.state.lines[index],
          index: index,
          endOfLine: endOfLine
        }
      }
    }
    // char is after the end of the last line
    let last = this.state.lines.length - 1
    return {
      line: this.state.lines[last],
      index: last,
      endOfLine: true
    }
  },

  /** For debugging */
  _reset() {
    this.replica.set('123456789')
    this.resetPosition()
    this.refs.input.focus()
  },

  /** For debugging */
  _dumpReplica() {
    let text = this.replica.getTextRange(BASE_CHAR)
    console.log('Current replica text: [' + text.map(c => c.char).join('') + ']')
    console.log('Current replica contents:')
    console.dir(text)
    this.refs.input.focus()
  },

  /** For debugging */
  _dumpPosition() {
    if(this.state.position) {
      console.log('Current position:', this.state.position)
    } else {
      console.log('No active position')
    }
    console.log('Current position eol start:', this.state.positionEolStart)
    this.refs.input.focus()
  },

  /** For debugging */
  _dumpSelection() {
    if(this.state.selectionActive) {
      console.log('Current selection contents: [' + this.replica.getTextRange(
        this.state.selectionLeftChar, this.state.selectionRightChar).map(c => c.char).join('') + ']')
      console.log('Left=', this.state.selectionLeftChar)
      console.log('Right=', this.state.selectionRightChar)
      console.log('Anchor=', this.state.selectionAnchorChar)
    } else {
      console.log('No active selection')
    }
    this.refs.input.focus()
  },

  /** For debugging */
  _forceRender() {
    this.forceUpdate(() => console.log('Render done.'))
  },

  _renderSelectionOverlay(lineIndex, lineHeight) {
    if(!this.state.selectionActive) {
      return null
    }

    let line = this.state.lines[lineIndex]

    if(this.replica.compareCharPos(this.state.selectionLeftChar, line.end) > 0
      || this.replica.compareCharPos(this.state.selectionRightChar, line.start) < 0) {
      return null
    }

    let left = null
    let right = null

    if(this.replica.compareCharPos(this.state.selectionLeftChar, line.start) < 0) {
      left = line.start
    } else {
      left = this.state.selectionLeftChar
    }

    if(this.replica.compareCharPos(this.state.selectionRightChar, line.end) > 0) {
      right = line.end
    } else {
      right = this.state.selectionRightChar
    }

    // TODO change selection height and font size dynamically
    let leftChars = this.replica.getTextRange(line.start, left)
    let selectionLeftX = this.advanceXForChars(this.props.fontSize, leftChars)

    let selectionChars = this.replica.getTextRange(left, right)
    let selectionWidthX = this.advanceXForChars(this.props.fontSize, selectionChars)

    let selectionHeight = Math.round(lineHeight * 10) / 10

    return (
      <div className="text-selection-overlay text-htmloverlay ui-unprintable text-htmloverlay-under-text"
        style={{top: 0, left: selectionLeftX, width: selectionWidthX, height: selectionHeight}}></div>
    )
  },

  _renderStyledText(id, text, attributes) {
    let hasAttribute = hasAttributeFor(attributes)

    // vertical alignment
    let superscript = hasAttribute(ATTR.SUPERSCRIPT)
    let subscript = hasAttribute(ATTR.SUBSCRIPT)
    let verticalAlign = classNames({
      super: superscript,
      sub: subscript,
      baseline: !(superscript || subscript)
    })

    // font size, weight, style
    let fontSize = this.fontSizeFromAttributes(this.props.fontSize, attributes)
    let fontWeight = hasAttribute(ATTR.BOLD) ? 'bold' : 'normal'
    let fontStyle = hasAttribute(ATTR.ITALIC) ? 'italic' : 'normal'

    // text-decoration
    let underline = hasAttribute(ATTR.UNDERLINE)
    let strikethrough = hasAttribute(ATTR.STRIKETHROUGH)
    let textDecoration = classNames({
      none: !(underline || strikethrough),
      underline: underline,
      'line-through': strikethrough
    })

    /*font-family:OpenSans;*/
    let style = {
      color: '#000000',
      backgroundColor: 'transparent',
      fontSize: fontSize,
      fontWeight: fontWeight,
      fontStyle: fontStyle,
      fontVariant: 'normal',
      textDecoration: textDecoration,
      verticalAlign: verticalAlign
    }

    return (
      <span style={style} key={id} id={id}>{text}</span>
    )
  },

  _splitIntoLines() {
    if(!this.state.lines) return []

    let chunkToStyledText = chunk => this._renderStyledText(chunk.text[0].id,
      chunk.text.map(c => c.char === ' ' ? nbsp : c.char).join(''), chunk.attributes)

    return this.state.lines.map(line => line.chunks.map(chunkToStyledText))
  },

  _renderLine(line, index, lineHeight) {
    let blockHeight = 10000
    let blockTop = this.top(this.props.fontSize) - blockHeight
    // TODO set lineHeight based on font sizes used in line chunks
    // the span wrapper around the text is required so that the text does not shift up/down when using superscript/subscript
    return (
      <div className="text-lineview" style={{height: lineHeight, direction: 'ltr', textAlign: 'left'}} key={index}>
        {this._renderSelectionOverlay(index, lineHeight)}
        <div className="text-lineview-content" style={{marginLeft: 0, paddingTop: 0}}>
          <span style={{display: 'inline-block', height: blockHeight}}></span>
          <span style={{display: 'inline-block', position: 'relative', top: blockTop}}>
            <span key="text" className="editor-inline-block text-lineview-text-block">{line}</span>
          </span>
        </div>
      </div>
    )
  },

  _renderCursor(lineHeight) {
    if (this.state.selectionActive) {
      return null
    }

    // the initial render before the component is mounted has no position or lines
    if (!this.state.position || !this.state.lines) {
      return null
    }

    let cursorClasses = classNames('text-cursor', 'ui-unprintable', {
      'text-cursor-blink': !this.state.cursorMotion
    })

    let caretClasses = classNames('text-cursor-caret', {
      'text-cursor-italic': this.state.position.attributes && this.state.position.attributes[ATTR.ITALIC]
    })

    let cursorStyle = {opacity: 1}

    let {line, index, endOfLine} = this._lineContainingChar(this.state.position, this.state.positionEolStart)
    let previousLineHeights = line ? lineHeight * index : 0

    // The cursor position is relative to the first parent of the paragraph container with position=relative that is
    // a common parent with the cursor div we are rendering --> it should be the text-content-wrapper
    let paragraphContainerPosition = elementPosition(this.paragraphContainer,
      (elem) => elem.className.indexOf('text-content-wrapper') >= 0)
    let cursorAdvanceX

    if(!line || (endOfLine && this.state.positionEolStart && index < this.state.lines.length - 1)) {
      cursorAdvanceX = 0
    } else {
      let positionChars = this.replica.getTextRange(line.start, this.state.position)
      cursorAdvanceX = this.advanceXForChars(this.props.fontSize, positionChars)
    }

    cursorStyle.left = paragraphContainerPosition.x + cursorAdvanceX
    cursorStyle.top = paragraphContainerPosition.y + previousLineHeights
/*
    cursorStyle.opacity = 0
    cursorStyle.display = 'none'
    cursorStyle.visibility = 'hidden'
*/
    let cursorHeight = Math.round(lineHeight * 10) / 10

    return (
      <div className={cursorClasses} style={cursorStyle} key="cursor">
        <div className={caretClasses} style={{borderColor: 'black', height: cursorHeight}}></div>
        <div className="text-cursor-top" style={{opacity: 0, display: 'none'}}></div>
        <div className="text-cursor-name" style={{opacity: 0, display: 'none'}}></div>
      </div>
    )
  },

  // TODO cursor is rendered at the document level in docs, we could do editor-level
  // TODO can do the onClick handler at at a higher level too, that way we can click outside elements e.g. before and after line ends
  render() {
    let id = this.props.id

    let lineHeight = this.lineHeight(this.props.fontSize)
    let lines = this._splitIntoLines()

    return (
      <div ref="paragraphContainer">
        <div onMouseDown={this._onMouseDown} onMouseMove={this._onMouseMove}>
          <TextInput id={id} ref="input" {...this.inputFunctions}/>
          <div className="text-paragraph">
            { lines.length > 0 ?
              lines.map((line, index) =>this._renderLine(line, index, lineHeight) ) :
              this._renderLine(nbsp, 0, lineHeight)}
          </div>
          {this._renderCursor(lineHeight)}
        </div>
        {/*
        <div className="text-lineview-debug">
          <button onClick={this._reset}>Reset</button>&nbsp;
          <button onClick={this._dumpReplica}>Dump Replica</button>&nbsp;
          <button onClick={this._dumpPosition}>Dump Position</button>&nbsp;
          <button onClick={this._dumpSelection}>Dump Selection</button>&nbsp;
          <button onClick={this._forceRender}>Force Render</button>&nbsp;
        </div>
        */}
      </div>
    )
  }

})

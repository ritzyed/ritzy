import 'babel/polyfill'

import React from 'react/addons'
import invariant from 'react/lib/invariant'
import _ from 'lodash'
import classNames from 'classnames'
import bs from 'binarysearch'

import { BASE_CHAR, EOF } from 'RichText'
import { elementPosition, scrollByToVisible } from 'dom'
import { pushArray, logInGroup } from 'utils'
import { default as tokenizer, isWhitespace } from 'tokenizer'
import TextReplicaMixin from './TextReplicaMixin'
import TextFontMetricsMixin from './TextFontMetricsMixin'
import TextInput from './TextInput'
import {ATTR, hasAttributeFor, attributesEqual} from '../core/attributes'

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
      insertCharsBatch: this.insertCharsBatch,
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
      eraseSelection: this.eraseSelection,
      toggleBold: this.toggleBold,
      toggleItalics: this.toggleItalics,
      toggleUnderline: this.toggleUnderline,
      toggleStrikethrough: this.toggleStrikethrough,
      toggleSuperscript: this.toggleSuperscript,
      toggleSubscript: this.toggleSubscript,
      getSelection: this.getSelection
    }
  },

  componentDidMount() {
    this.clickCount = 0
    this.upDownAdvanceX = null
    this.upDownPositionEolStart = null
    this.editorContentsContainer = React.findDOMNode(this.refs.editorContentsContainer)
    this.caret = React.findDOMNode(this.refs.caret)

    this.refs.input.focus()
    this.flow()
  },

  componentDidUpdate() {
    if(!this.caret) {
      this.caret = React.findDOMNode(this.refs.caret)
    }
    if(this.caret) {
      let scrollByToCursor = scrollByToVisible(this.caret, 5)
      if(scrollByToCursor.xDelta !== 0 || scrollByToCursor.yDelta !== 0) {
        window.scrollBy(scrollByToCursor.xDelta, scrollByToCursor.yDelta)
      }
    }
  },

  /**
   * Sets the character and cursor position within the text. The position is relative to an existing
   * character given by its replica id. The cursor position is calculated based on the character
   * position. This is generally straightforward except when the character position is the last
   * character of a line. In this situation, there are two possible cursor positions: at the end of
   * the line, or at the beginning of the next line. The desired cursor location depends on how one
   * got there e.g. hitting "end" on a line should keep you on the same line, hitting "home" on the
   * next line takes you to the same character position, except at the beginning of that line.
   *
   * @param {object} position The character position to set.
   * @param {boolean} [positionEolStart = true] positionEolStart When rendering the cursor, this state
   *   determines the cursor position when the character position is at a line end: whether to place
   *   the cursor at the start of the next line (positionEolStart = true), or at the end of the
   *   current one (positionEolStart = false). If the cursor position is not at a line end, this state
   *   is ignored by the renderer. Since this state is often "left over" from previous calls to setPosition
   *   it should not be trusted other than for rendering.
   * @param {boolean} [resetUpDown = true] resetUpDown Whether to reset the up/down advance
   *   and position values.
   */
  setPosition(position, positionEolStart, resetUpDown) {
    if(_.isUndefined(positionEolStart)) positionEolStart = this.state.positionEolStart
    if(_.isUndefined(resetUpDown)) resetUpDown = true

    //console.debug('position', position, 'positionEolStart', positionEolStart, 'resetUpDown', resetUpDown)

    this.setState({
      position: position,
      positionEolStart: positionEolStart,
      selectionActive: false,
      activeAttributes: null
    })

    if(resetUpDown) {
      this.upDownAdvanceX = null
      this.upDownPositionEolStart = null
    }
    this.refs.input.focus()
    this._delayedCursorBlink()
  },

  resetPosition() {
    this.setPosition(BASE_CHAR)
  },

  /**
   * Flows the content i.e. wraps the text into multiple lines, splits each line into chunks with the same
   * attributes, and sets the component state based on the result. This state is then used for rendering the
   * editor surface during the next render cycle. This should be called after any operation that may change
   * the content flow, such as inserting or deleting text.
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
        this.lastCharSpace = false
      },

      pushChar(c, thisRef) {
        if(!this.attributes) {
          this.attributes = c.attributes
        }
        let charAdvance = thisRef.advanceXForChars(thisRef.props.fontSize, c)

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
      }
    }

    let currentLine = {
      chunks: [],
      advance: 0,
      start: BASE_CHAR,
      end: null,

      reset() {
        this.chunks = []
        this.advance = 0
        this.start = lines.length > 0 ? lines[lines.length - 1].end : BASE_CHAR
        this.end = null
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
          let lastChunk = this.chunks[this.chunks.length - 1]
          this.end = lastChunk.text[lastChunk.text.length - 1]
        }
        this.advance += word.lineAdvance
        word.reset()
      },

      pushNewline(c) {
        invariant(c.char === '\n', 'pushNewline can only be called with a newline char.')
        this.end = c
      },

      pushEof() {
        this.end = EOF
      }
    }

    let pushLine = (line) => {
      if(line.end) {
        lines.push({
          isHard() {
            return this.end.char === '\n'
          },
          isEof() {
            return this.end === EOF
          },
          toString() {
            let chunks = '-'
            if(this.chunks && this.chunks.length > 0) {
              let text = this.chunks[0].text.map(c => c.char)
              if(text.length > 10) {
                text = text.slice(0, 10)
                chunks = text.join('') + '...'
              } else {
                chunks = text.join('')
              }
            }
            return `${chunks} chars=[${this.start.toString()} → ${this.end.toString()}] adv=${this.advance}}`
          },
          chunks: line.chunks,
          start: line.start,
          end: line.end,
          advance: line.advance
        })
      }
      line.reset()
    }

    let processChar = (c) => {
      if (!attributesEqual(currentWord.attributes, c.attributes)) {
        currentWord.pushChunks()
      }

      if(c.char !== '\n' && c.char !== ' ' && currentWord.lastCharSpace) {
        // new word
        currentWord.pushChunks()
        currentLine.pushWord(currentWord)
        currentWord.pushChar(c, this)
      } else if(c.char === '\n') {
        // new line
        currentWord.pushChunks()
        currentLine.pushWord(currentWord)
        currentLine.pushNewline(c)
        pushLine(currentLine)
      } else {
        currentWord.pushChar(c, this)
      }

      // check for line wrap
      if(currentLine.advance === 0 && currentWord.advance > this.props.width) {
        // word longer than a line, here we need to remove the last char to get us back under the line width
        let lastChar = currentWord.popChar()
        currentWord.pushChunks()
        currentLine.pushWord(currentWord)
        pushLine(currentLine)
        processChar(lastChar)
      } else if (currentLine.advance + currentWord.advance > this.props.width) {
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

    // add an empty last line if the last line ended with a newline
    if(lines.length > 0 && lines[lines.length - 1].isHard()) {
      currentLine.pushEof()
      pushLine(currentLine)
    }

    this.setState({lines: lines})
  },

  insertChars(value, attributes, atPosition, reflow) {
    if(_.isUndefined(reflow)) reflow = true
    let position
    if(atPosition) {
      position = atPosition
    } else {
      position = this.state.position
    }
    // if the last char is a newline, then we want to position on the start of the next line
    let positionEolStart = value.slice(-1) === '\n'

    if(this.state.selectionActive) {
      position = this.state.selectionLeftChar
      this._eraseSelection()
    }

    if(!attributes) {
      if(this.state.selectionActive) {
        position = this.state.selectionLeftChar
        // if selection, then activeAttributes (set by command or toolbar) are set by the first selected char
        attributes = this.relativeChar(position, 1, 'limit').attributes
      } else {
        attributes = this.state.activeAttributes ?
          this.state.activeAttributes :
          this.relativeChar(position, 0).attributes // reload attributes from the replica in case they have changed
      }
    }

    this.replica.insertCharsAt(position, value, attributes)

    let relativeMove = value.length
    let newPosition = this.relativeChar(position, relativeMove)
    this.setPosition(newPosition, positionEolStart)
    this.setState({activeAttributes: attributes})

    if(reflow) this.flow()

    // return the new position so that multiple insertChars calls can be made in sequence
    return newPosition
  },

  insertCharsBatch(chunks) {
    let insertPosition = null
    chunks.forEach(c => {
      insertPosition = this.insertChars(c.text, c.attrs, insertPosition, false)
    })
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
    this.setPosition(BASE_CHAR, true)
  },

  navigateStartLine() {
    let {line} = this._lineContainingChar(this.state.position, this.state.positionEolStart)
    this.setPosition(line.start, true)
  },

  navigateEnd() {
    let positionEolStart = false
    if(this.state.lines && this._lastLine().isEof()) {
      positionEolStart = true
    }
    this.setPosition(this.relativeChar(BASE_CHAR, -1), positionEolStart)
  },

  navigateEndLine() {
    let {line} = this._lineContainingChar(this.state.position, this.state.positionEolStart)
    let position
    let positionEolStart = false
    if(line.isEof() || line.chunks.length === 0) {
      position = this.state.position
      positionEolStart = true
    } else if (line.isHard()) {
      position = this.relativeChar(line.end, -1, 'limit')
    } else {
      position = line.end
    }
    this.setPosition(position, positionEolStart)
  },

  navigateWordLeft() {
    this._navigateWordLeftRight(-1)
  },

  navigateWordRight() {
    this._navigateWordLeftRight(1)
  },

  selectionLeft() {
    this._selectionLeftRight(-1)
  },

  selectionRight() {
    this._selectionLeftRight(1)
  },

  selectionUp() {
    this._selectionUpDown(-1)
  },

  selectionDown() {
    this._selectionUpDown(1)
  },

  selectionStart() {
    this._modifySelection(BASE_CHAR, true)
  },

  selectionStartLine() {
    let {line} = this._lineContainingChar(this.state.position, this.state.positionEolStart)
    this._modifySelection(line.start, true)
  },

  selectionEnd() {
    let toChar = this._lastLine().isEof() ? EOF : this.relativeChar(BASE_CHAR, -1)
    this._modifySelection(toChar, toChar === EOF)
  },

  /**
   * Google docs behavior (as of 2015-06-22) is:
   * - line with soft return, select line with space at end
   * - line with hard return, select line without selecting the hard return (no action on empty lines)
   * - EOF line, no action
   *
   * Word 2010 behavior is:
   * - line with soft return, select line with space at end
   * - line with hard return, select line including the hard return (same on empty lines)
   * - EOF line, show "space" selection at EOF containing a newline
   *
   * We implement the Google docs behavior here, which seems a bit more intuitive.
   */
  selectionEndLine() {
    let {line} = this._lineContainingChar(this.state.position, this.state.positionEolStart)
    let toChar
    let positionEolStart = false
    if(line.isEof()) {
      toChar = this.state.position
      positionEolStart = true
    } else if (line.isHard()) {
      toChar = this.relativeChar(line.end, -1, 'limit')
    } else {
      toChar = line.end
    }
    this._modifySelection(toChar, positionEolStart)
  },

  selectionWordLeft() {
    let position
    let positionEolStart
    if(this.state.position === EOF) {
      position = this._lastLine().start
      positionEolStart = true
    } else {
      position = this._wordStartRelativeTo(this.state.position)
      positionEolStart = !this._lineContainingChar(this.state.position).endOfLine
    }
    this._modifySelection(position, positionEolStart)
  },

  selectionWordRight() {
    let position = this._wordEndRelativeTo(this.state.position)
    let endOfLine = this._lineContainingChar(this.state.position).endOfLine

    this._modifySelection(position, !endOfLine)
  },

  eraseCharBack() {
    if(this.state.selectionActive) {
      this._eraseSelection()
    } else {
      let position = this.relativeChar(this.state.position, -1)
      this.replica.rmChars(this.state.position)
      this.flow()

      let endOfLine = this._lineContainingChar(position).endOfLine
      this.setPosition(position, endOfLine)
    }
  },

  eraseCharForward() {
    if(this.state.selectionActive) {
      this._eraseSelection()
    } else {
      let next = this.relativeChar(this.state.position, 1, 'limit')
      this.replica.rmChars(next)
      this.flow()

      let endOfLine = this._lineContainingChar(next).endOfLine
      this.setPosition(next, endOfLine)
    }
  },

  eraseWordBack() {
    if(this.state.selectionActive) {
      this._eraseSelection()
    } else {
      let position = this.state.position
      let start = this._wordStartRelativeTo(position)
      let end = position
      if(this.replica.charEq(start, position)) {
        // beginning of word, move to the previous word
        let previousStart = this._wordStartRelativeTo(this.relativeChar(position, -1, 'limit'))
        // no previous word, nothing to delete
        if(start === previousStart) return
        end = this._wordEndRelativeTo(start)
      }

      // TODO delete at beginning of line deletes last word on previous line or last word of previous paragraph

      let wordChars = this.replica.getTextRange(start, end)
      this.replica.rmChars(wordChars)
      this.flow()

      let endOfLine = this._lineContainingChar(position).endOfLine
      this.setPosition(position, endOfLine)
    }
  },

  eraseWordForward() {
    if(this.state.selectionActive) {
      this._eraseSelection()
    } else {
      let position = this.state.position
      let options
      if(isWhitespace(this.relativeChar(position, 1, 'limit').char)) {
        options = { includeLeadingSpace: true }
      }
      let start = position
      let end = this._wordEndRelativeTo(start, options)
      if(this.replica.charEq(end, position)) {
        // ending of word, move to the next word
        let nextEnd = this._wordEndRelativeTo(this.relativeChar(position, 1, 'limit'), options)
        // no next word, nothing to delete
        if(end === nextEnd) return
        start = this._wordStartRelativeTo(end, options)
      }

      // TODO delete at end of line deletes first word on next line or first word of next paragraph

      let wordChars = this.replica.getTextRange(start, end)
      this.replica.rmChars(wordChars)
      this.flow()

      let endOfLine = this._lineContainingChar(position).endOfLine
      this.setPosition(position, endOfLine)
    }
  },

  eraseSelection() {
    if(this.state.selectionActive) {
      this._eraseSelection()
    }
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

  getSelection() {
    let selectionChunks = []

    if(!this.state.selectionActive) {
      return selectionChunks
    }

    let currentChunk = {
      chars: [],
      attributes: null,

      reset() {
        this.chars = []
        this.attributes = null
      },

      pushChar(c) {
        if(!this.attributes) {
          this.attributes = c.attributes
        }
        // push newlines as separate chunks for ease of parsing paragraphs and breaks from chunks
        if(c.char === '\n') {
          // previous chunk
          this.pushChunk()
        }
        this.chars.push(c.char)
        if(c.char === '\n') {
          // newline chunk
          this.pushChunk()
        }
      },

      pushChunk() {
        if(this.chars.length > 0) {
          selectionChunks.push({
            text: this.chars.join(''),
            attrs: this.attributes
          })
        }
        this.reset()
      }
    }

    let processChar = (c) => {
      if (!attributesEqual(currentChunk.attributes, c.attributes)) {
        currentChunk.pushChunk()
      }
      currentChunk.pushChar(c, this)
    }

    let selectionChars = this.replica.getTextRange(this.state.selectionLeftChar, this.state.selectionRightChar)
    let contentIterator = selectionChars[Symbol.iterator]()
    let e
    while(!(e = contentIterator.next()).done) {
      processChar(e.value)
    }
    // last chunk
    currentChunk.pushChunk()

    return selectionChunks
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

  _lastLine() {
    return this.state.lines[this.state.lines.length - 1]
  },

  _modifySelection(toChar, positionEolStart, resetUpDown) {
    if(!toChar) return
    if(_.isUndefined(resetUpDown)) resetUpDown = true

    this.setState((previousState) => {
      if(previousState.selectionActive) {
        if(this.replica.charEq(previousState.selectionAnchorChar, previousState.selectionLeftChar)) {
          let compareAnchorPos = this.replica.compareCharPos(toChar, previousState.selectionAnchorChar)
          if(compareAnchorPos < 0) {
            return {
              selectionRightChar: previousState.selectionAnchorChar,
              selectionLeftChar: toChar,
              position: toChar,
              positionEolStart: positionEolStart
            }
          } else if(compareAnchorPos > 0) {
            return {
              selectionRightChar: toChar,
              position: toChar,
              positionEolStart: positionEolStart
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
              positionEolStart: positionEolStart
            }
          } else if(compareAnchorPos > 0) {
            return {
              selectionLeftChar: toChar,
              position: toChar,
              positionEolStart: positionEolStart
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
          positionEolStart: positionEolStart
        }
      }
      // TODO toolbar state based on common rich text attributes of selection
    })
    if(resetUpDown) {
      this.upDownAdvanceX = null
      this.upDownPositionEolStart = null
    }
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
    let charIndex = textChars.findIndex(e => this.replica.charEq(e, char)) + 1
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
      return this._lastLine().isEof() ? EOF : this.relativeChar(BASE_CHAR, -1)
    }
  },

  _mouseEventToPositionAndCursorX(e) {
    // hack: if the user clicks or rolls over their own cursor sometimes that becomes the target element (in browsers
    // that don't support pointer-events: none, like IE < 11): BUT we know the cursor is the current position
    if(e.target.className.indexOf('text-cursor-caret') >= 0) {
      return {
        position: this.state.position,
        positionEolStart: this.state.positionEolStart
      }
    }

    // target is the particular element within the editor clicked on, current target is the entire editor div
    let targetPosition = elementPosition(e.currentTarget)
    let mouseX = e.pageX - targetPosition.x
    let mouseY = e.pageY - targetPosition.y

    // TODO this works for now since all line heights are the same, but get the heights of each line dynamically
    let lineHeight = this.lineHeight(this.props.fontSize)
    let lineIndex = Math.floor(mouseY / lineHeight)

    if(lineIndex > this.state.lines.length - 1) {
      // clicked after the last line, set cursor on the last line
      lineIndex = this.state.lines.length - 1
    }

    if(lineIndex < 0) {
      return {
        position: BASE_CHAR,
        positionEolStart: true
      }
    }

    let position
    let positionEolStart
    let line = this.state.lines[lineIndex]
    let traversedX = 0
    for(let chunk of line.chunks) {
      let advanceX = this.advanceXForChars(this.props.fontSize, chunk.text)
      if(traversedX + advanceX >= mouseX) {
        let indexAndCursor = this.indexAndCursorForXValue(this.props.fontSize, mouseX - traversedX, chunk.text)
        position = this._charPositionRelativeToIndex(indexAndCursor.index, chunk.text)

        // if clicked a line beginning (char position is end of last line) then position beginning of clicked line
        let cursorX = traversedX + indexAndCursor.cursorX
        positionEolStart = cursorX === 0 || line.isEof()

        // note that the cursorX is relative to the beginning of the line
        return {
          position: position,
          positionEolStart: positionEolStart
        }
      } else {
        traversedX += advanceX
      }
    }

    if(line.isEof()) {
      position = line.start
      positionEolStart = true
    } else if(line.isHard() && (line.chunks.length > 0 || !this.replica.charEq(line.start, line.end))) {
      // position just before the end newline
      position = this.relativeChar(line.end, -1, 'limit')
      positionEolStart = true
    } else {
      position = line.end
      positionEolStart = false
    }

    return {
      position: position,
      positionEolStart: positionEolStart
    }
  },

  _doOnSingleClick(e) {
    let {position, positionEolStart} = this._mouseEventToPositionAndCursorX(e)

    // save the position for a potential double-click
    this.savedPosition = position

    if(e.shiftKey) {
      this._modifySelection(position, positionEolStart)
    } else {
      // set the position and selection anchor if the user continues the selection later
      position = position ? position : BASE_CHAR

      this.setPosition(position, positionEolStart)
      this.setState({
        selectionAnchorChar: position
      })
    }
  },

  /**
   * Double-click does a word selection. Follows Google Docs and Microsoft Word 2010 behavior of:
   * - selecting the word that was clicked, and one or more spaces following it
   * - if clicking at the end of a line with a soft return, the first word on the next line is selected
   * - if clicking at the end of a line with a hard return, the hard return is selected (shown as a "space")
   * - if clicking at the end of the last (empty) line, a (non-existent) hard return at EOF is selected (shown as
   *   a "space")
   */
  _doOnDoubleClick() {
    if(!this.savedPosition) return

    // handle cursor at EOF
    if(this._lineContainingChar(this.savedPosition, true).line.isEof()) {
      this.setPosition(this.savedPosition)
      this._modifySelection(EOF, true)
    } else {
      let word = this._wordRelativeTo(this.savedPosition)
      this.setPosition(word.start)
      this._modifySelection(word.end, false)
    }
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

    let {position, positionEolStart} = this._mouseEventToPositionAndCursorX(e)

    if(position) {
      this._modifySelection(position, positionEolStart)
    }

    e.preventDefault()
    e.stopPropagation()
  },

  _eraseSelection() {
    invariant(this.state.selectionActive, 'Selection must be active to erase it.')
    let position = this.state.selectionLeftChar

    let selectionChars = this.replica.getTextRange(this.state.selectionLeftChar, this.state.selectionRightChar)
    this.replica.rmChars(selectionChars)
    this.flow()

    let endOfLine = this._lineContainingChar(position).endOfLine
    this.setPosition(position, endOfLine)
  },

  _navigateLeftRight(charCount) {
    let position
    if(this.state.selectionActive && charCount < 0) {
      // left from left char
      position = this.state.selectionLeftChar
    } else if(this.state.selectionActive) {
      // right from right char
      position = this.state.selectionRightChar
    } else {
      position = this.relativeChar(this.state.position, charCount, 'limit')
    }
    let endOfLine = this._lineContainingChar(position).endOfLine
    this.setPosition(position, endOfLine)
  },

  _navigateUpDown(lineCount) {
    if(this.state.selectionActive) {
      // collapse the selection and position the cursor relative to the left (if up) or right (if down)
      let position
      let positionEolStart
      if(lineCount < 0) {
        position = this.state.selectionLeftChar
        positionEolStart = true
      } else if(this.state.selectionActive) {
        position = this.state.selectionRightChar
        positionEolStart = false
      }
      this.setPosition(position, positionEolStart)
    }

    let upDownAdvanceX = this.upDownAdvanceX
    let positionEolStart = this.upDownPositionEolStart
    let currentLineAndAdvance = this._lineAndAdvanceAtPosition(this.state.position, this.state.positionEolStart)
    let index = currentLineAndAdvance.index

    if(this.upDownAdvanceX == null || this.upDownPositionEolStart == null) {
      upDownAdvanceX = currentLineAndAdvance.advanceX
      positionEolStart = this.state.positionEolStart

      // save the advance and positionEolStart in case the user navigates up or down again
      this.upDownAdvanceX = upDownAdvanceX
      this.upDownPositionEolStart = positionEolStart
    }

    if(index + lineCount < 0 || index + lineCount > this.state.lines.length - 1) {
      // nowhere to go, just unblink for a second to indicate to the user input was received
      this._delayedCursorBlink()
    } else {
      let targetLine = this.state.lines[index + lineCount]
      let newPosition
      if(targetLine.isEof()) {
        newPosition = targetLine.start
        positionEolStart = true
      } else {
        let chars = this.replica.getTextRange(targetLine.start, targetLine.end)
        let indexAndCursor = this.indexAndCursorForXValue(this.props.fontSize, upDownAdvanceX, chars)
        newPosition = this._charPositionRelativeToIndex(indexAndCursor.index, chars)

        // if the new position is the start of the line, position the cursor at the start of the line
        positionEolStart = this.replica.charEq(newPosition, targetLine.start)
      }
      this.setPosition(newPosition, positionEolStart, false)
    }
  },

  _navigateWordLeftRight(wordCount) {
    let position
    if(this.state.selectionActive && wordCount < 0) {
      // start from one character into the selection left char so that relative to the left selected word
      position = this.relativeChar(this.state.selectionLeftChar, 1, 'limit')
    } else if(this.state.selectionActive) {
      // start from one character before the selection right char so that relative to the right selected word
      position = this.relativeChar(this.state.selectionRightChar, -1, 'limit')
    } else {
      position = this.state.position
    }
    let relativeTo = wordCount < 0 ? this._wordStartRelativeTo : this._wordEndRelativeTo
    position = relativeTo(position)
    let endOfLine = this._lineContainingChar(position).endOfLine
    this.setPosition(position, endOfLine)
  },

  _selectionLeftRight(charCount) {
    let endOfLine = this._lineContainingChar(this.state.position).endOfLine
    let toChar = this.relativeChar(this.state.position, charCount, 'eof')
    if(toChar === EOF && !this._lastLine().isEof()) {
      toChar = this._lastLine().end
    }
    this._modifySelection(toChar, (this.state.position === EOF && charCount === -1) || !endOfLine)
  },

  _selectionUpDown(lineCount) {
    let upDownAdvanceX = this.upDownAdvanceX
    let positionEolStart = this.upDownPositionEolStart
    let currentLineAndAdvance = this._lineAndAdvanceAtPosition(this.state.position, this.state.positionEolStart)
    let line = currentLineAndAdvance.line
    let index = currentLineAndAdvance.index

    if(this.upDownAdvanceX == null || this.upDownPositionEolStart == null) {
      upDownAdvanceX = currentLineAndAdvance.advanceX
      positionEolStart = this.state.positionEolStart

      // save the advance and positionEolStart in case the user navigates up or down again
      this.upDownAdvanceX = upDownAdvanceX
      this.upDownPositionEolStart = positionEolStart
    }

    if(index + lineCount < 0) {
      this._modifySelection(BASE_CHAR, true)
      // at start of first line, reset the advanceX, and positionEolStart is now true
      this.upDownAdvanceX = 0
      this.upDownPositionEolStart = true
    } else if(index + lineCount > this.state.lines.length - 1 && !this._lastLine().isEof()) {
      // trying to navigate past the last line (and last line does not have an EOF), position at end of line
      let toChar = this.relativeChar(BASE_CHAR, -1)
      this._modifySelection(toChar, false)
      // at end of last line, reset the advanceX to the end of the line, and positionEolStart is now false
      let chars = this.replica.getTextRange(line.start, line.end)
      this.upDownAdvanceX = this.advanceXForChars(this.props.fontSize, chars)
      this.upDownPositionEolStart = false
    } else if(index + lineCount >= this.state.lines.length - 1 && this._lastLine().isEof()) {
      this._modifySelection(EOF, true, false)
    } else {
      let targetLine = this.state.lines[index + lineCount]
      let newPosition
      if(targetLine.isEof()) {
        newPosition = targetLine.start
        positionEolStart = true
      } else {
        let chars = this.replica.getTextRange(targetLine.start, targetLine.end)
        let indexAndCursor = this.indexAndCursorForXValue(this.props.fontSize, upDownAdvanceX, chars)
        newPosition = this._charPositionRelativeToIndex(indexAndCursor.index, chars)

        // if the new position is the start of the line, position the cursor at the start of the line
        positionEolStart = this.replica.charEq(newPosition, targetLine.start)
      }
      this._modifySelection(newPosition, positionEolStart, false)
    }
  },

  _toggleAttribute(attribute, exclusiveWith) {
    if(this.state.selectionActive) {
      let selectionChars = this.replica.getTextRange(this.state.selectionLeftChar, this.state.selectionRightChar)
      let charsWithAttrNotSet = selectionChars.filter(c => !c.attributes || !c.attributes[attribute])

      let setAttr = {}

      if(charsWithAttrNotSet && charsWithAttrNotSet.length > 0) {
        let attr = {}
        attr[attribute] = true

        for(let i = 0; i < charsWithAttrNotSet.length; i++) {
          let currentAttrs = charsWithAttrNotSet[i].attributes
          if(exclusiveWith && currentAttrs && currentAttrs[exclusiveWith]) delete currentAttrs[exclusiveWith]
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
      let activeAttributes = this.state.activeAttributes
      if(activeAttributes) {
        activeAttributes[attribute] = !activeAttributes[attribute]
        if(activeAttributes[attribute] && exclusiveWith && activeAttributes[exclusiveWith]) {
          activeAttributes[exclusiveWith] = false
        }
      } else if(this.state.position) {
        let currentAttrs = this.relativeChar(this.state.position, 0, 'limit').attributes
        if(currentAttrs) {
          currentAttrs[attribute] = !currentAttrs[attribute]
          activeAttributes = currentAttrs
          if(activeAttributes[attribute] && exclusiveWith && activeAttributes[exclusiveWith]) {
            activeAttributes[exclusiveWith] = false
          }
        } else {
          activeAttributes = {}
          activeAttributes[attribute] = true
        }
      }
      this.setState({activeAttributes: activeAttributes})
    }
  },

  _lineContainingChar(char, nextIfEol, searchSpace) {
    if(_.isUndefined(nextIfEol)) nextIfEol = false
    if(_.isUndefined(searchSpace)) {
      invariant(this.state.lines, 'Lines must be defined in the state when search space is not provided.')
      searchSpace = this.state.lines
    }

    if(!searchSpace || searchSpace.length === 0) {
      return null
    }

    // shortcut searches at the beginning or end of the searchSpace, this is used often and these comparisons are fast
    if(this.replica.charEq(searchSpace[0].start, char)) {
      return {
        line: searchSpace[0],
        index: 0,
        endOfLine: !this.replica.charEq(char, BASE_CHAR)
      }
    } else if(this.replica.charEq(searchSpace[searchSpace.length - 1].end, char)) {
      return {
        line: searchSpace[searchSpace.length - 1],
        index: searchSpace.length - 1,
        endOfLine: true
      }
    }

    let comparator = (line, c) => {
      // shortcut fast equality comparisons with line.start and line.end
      if (this.replica.charEq(c, line.start)) return 1
      if (this.replica.charEq(c, line.end)) return 0
      if (this.replica.compareCharPos(c, line.start) < 0) return 1
      if (this.replica.compareCharPos(c, line.end) > 0) return -1
      return 0
    }

    let index = bs(searchSpace, char, comparator)
    if(index === -1) {
      return null
    }
    let line = searchSpace[index]

    let endOfLine = this.replica.charEq(char, line.end)
    if(nextIfEol && endOfLine && !line.isEof() && searchSpace.length - 1 > index) {
      index++
      line = searchSpace[index]
    }

    return {
      line: line,
      index: index,
      endOfLine: endOfLine
    }
  },

  _searchLinesWithSelection() {
    if(!this.state.lines || this.state.lines.length === 0 || !this.state.selectionActive) {
      return null
    }

    let left = this._lineContainingChar(this.state.selectionLeftChar)
    let right = this._lineContainingChar(this.state.selectionRightChar, null, this.state.lines.slice(left.index))

    return {
      left: left.index,
      right: right.index + left.index
    }
  },

  _lineAndAdvanceAtPosition(position, positionEolStart) {
    let {line, index, endOfLine} = this._lineContainingChar(position, positionEolStart)
    let advanceX

    if(this.replica.charEq(BASE_CHAR, position) || (endOfLine && positionEolStart)) {
      advanceX = 0
    } else {
      let chars = this.replica.getTextRange(line.start, position)
      advanceX = this.advanceXForChars(this.props.fontSize, chars)
    }

    return {
      advanceX: advanceX,
      line: line,
      index: index,
      endOfLine: endOfLine
    }
  },

  /** For debugging */
  _reset() {
    this.replica.set('123456789')
    this.resetPosition()
    this.flow()
    this.refs.input.focus()
  },

  /** For debugging */
  _dumpReplica() {
    let text = this.replica.getTextRange(BASE_CHAR)
    console.debug('Current replica text: [' + text.map(c => c.char).join('') + ']')
    console.debug('Current replica contents:')
    console.dir(text)
    this.refs.input.focus()
  },

  /** For debugging */
  _dumpPosition() {
    if(this.state.position) {
      console.debug('Current position:', this.state.position, 'positionEolStart:', this.state.positionEolStart)
    } else {
      console.debug('No active position')
    }
    this.refs.input.focus()
  },

  /** For debugging */
  _dumpCurrentLine() {
    logInGroup('Line debug', () => {
      if(this.state.lines) {
        let printLine = l => console.debug(l.toString())

        let currentLine = this._lineContainingChar(this.state.position, this.state.positionEolStart)
        if(!currentLine) {
          console.log(null)
        } else {
          if (currentLine.index > 0) {
            logInGroup('Before', () => {
              printLine(this.state.lines[currentLine.index - 1])
            })
          }
          logInGroup('Current', () => {
            console.debug('index', currentLine.index, 'endOfLine', currentLine.endOfLine)
            printLine(currentLine.line)
          })
          if (currentLine.index < this.state.lines.length - 1) {
            logInGroup('After', () => {
              printLine(this.state.lines[currentLine.index + 1])
            })
          }
        }
      } else {
        console.debug('No lines')
      }
    })
    this.refs.input.focus()
  },

  /** For debugging */
  _dumpLines() {
    if(this.state.lines) {
      console.debug('Current lines:', this.state.lines)
    } else {
      console.debug('No lines')
    }
    this.refs.input.focus()
  },

  /** For debugging */
  _dumpSelection() {
    if(this.state.selectionActive) {
      let selectionChars = this.replica.getTextRange(this.state.selectionLeftChar, this.state.selectionRightChar)
      console.debug('Current selection contents: [' + selectionChars.map(c => c.char).join('') + ']')
      console.debug('Left=', this.state.selectionLeftChar)
      console.debug('Right=', this.state.selectionRightChar)
      console.debug('Anchor=', this.state.selectionAnchorChar)
      console.debug('Chars=', selectionChars)
    } else {
      console.debug('No active selection')
    }
    this.refs.input.focus()
  },

  /** For debugging */
  _forceFlow() {
    this.flow()
    this.refs.input.focus()
  },

  /** For debugging */
  _forceRender() {
    this.forceUpdate(() => console.debug('Render done.'))
    this.refs.input.focus()
  },

  /** For debugging */
  _togglePositionEolStart() {
    this.setState(previousState => {
      let previous = previousState.positionEolStart
      console.debug('Toggling positionEolStart from ' + previous + ' to ' + !previous)
      return { positionEolStart: !previous }
    })
    this.refs.input.focus()
  },

  _renderSelectionOverlay(lineIndex, lineHeight) {
    if(!this.state.selectionActive) {
      return null
    }

    let selectionDiv = (leftX, widthX) => {
      let height = Math.round(lineHeight * 10) / 10
      return (
        <div className="text-selection-overlay text-htmloverlay ui-unprintable text-htmloverlay-under-text"
          style={{top: 0, left: leftX, width: widthX, height: height}}></div>
      )
    }

    let line = this.state.lines[lineIndex]

    if(line && line.isEof() && this.state.selectionRightChar === EOF) {
      return selectionDiv(0, this.advanceXForSpace(this.props.fontSize))
    }

    if(!line
      || line.isEof()
      || this.replica.compareCharPos(this.state.selectionLeftChar, line.end) > 0
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

    let selectionWidthX
    let selectionAddSpace
    if((right === EOF && line.isEof()) || (!line.isEof() && this.replica.charEq(right, line.end) && !this.replica.charEq(left, right))) {
      // shortcut when we select to end of line, we already know the line advance from the flow algorithm
      selectionWidthX = line.advance - selectionLeftX
      selectionAddSpace = line.isEof() || line.end.char === '\n'
    } else {
      let selectionChars = this.replica.getTextRange(left, right)
      if(selectionChars.length === 0) {
        return null
      }
      selectionWidthX = this.advanceXForChars(this.props.fontSize, selectionChars)
      selectionAddSpace = selectionChars[selectionChars.length - 1].char === '\n'
    }

    if(selectionAddSpace) {
      selectionWidthX += this.advanceXForSpace(this.props.fontSize)
    }

    return selectionDiv(selectionLeftX, selectionWidthX)
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

    let style = {
      color: '#000000',
      backgroundColor: 'transparent',
      fontFamily: 'Open Sans',  // TODO test other fonts, make the font selectable
      fontSize: fontSize,
      fontWeight: fontWeight,
      fontStyle: fontStyle,
      fontVariant: 'normal',
      textDecoration: textDecoration,
      verticalAlign: verticalAlign
    }

    return (
      <span style={style} key={id}>{text}</span>
    )
  },

  _splitIntoLines() {
    if(!this.state.lines) return []

    let chunkToStyledText = chunk => this._renderStyledText(chunk.text[0].id,
      chunk.text.map(c => c.char === ' ' ? nbsp : c.char).join(''), chunk.attributes)

    return this.state.lines.map(line => line.chunks.map(chunkToStyledText))
  },

  _renderLine(line, index, lineHeight, shouldRenderSelection) {
    let blockHeight = 10000
    let blockTop = this.top(this.props.fontSize) - blockHeight

    let renderSelectionOverlay = () => shouldRenderSelection ? this._renderSelectionOverlay(index, lineHeight) : null

    // TODO set lineHeight based on font sizes used in line chunks
    // the span wrapper around the text is required so that the text does not shift up/down when using superscript/subscript
    return (
      <div className="text-lineview" style={{height: lineHeight, direction: 'ltr', textAlign: 'left'}} key={index}>
        {renderSelectionOverlay()}
        <div className="text-lineview-content" style={{marginLeft: 0, paddingTop: 0}}>
          <span style={{display: 'inline-block', height: blockHeight}}></span>
          <span style={{display: 'inline-block', position: 'relative', top: blockTop}}>
            <span key="text" className="editor-inline-block text-lineview-text-block">{line}</span>
          </span>
        </div>
      </div>
    )
  },

  _cursorPosition(lineHeight) {
    // the initial render before the component is mounted has no position or lines
    if (!this.state.position || !this.state.lines || this.state.lines.length === 0) {
      return {
        left: 0,
        top: 0
      }
    }

    let {line, index, endOfLine} = this._lineContainingChar(this.state.position, this.state.positionEolStart)
    let previousLineHeights = line ? lineHeight * index : 0

    // The cursor position is relative to the first parent of the contents container with position=relative that is
    // a common parent with the cursor div we are rendering --> it should be the text-content-wrapper
    let contentsContainerPosition = elementPosition(this.editorContentsContainer,
      (elem) => elem.className.indexOf('text-content-wrapper') >= 0)
    let cursorAdvanceX

    if(!line || (endOfLine && this.state.positionEolStart && index < this.state.lines.length - 1)) {
      cursorAdvanceX = 0
    } else {
      let positionChars = this.replica.getTextRange(line.start, this.state.position)
      cursorAdvanceX = this.advanceXForChars(this.props.fontSize, positionChars)
    }

    return {
      left: contentsContainerPosition.x + cursorAdvanceX,
      top: contentsContainerPosition.y + previousLineHeights
    }
  },

  _renderInput(cursorPosition) {
    let position = cursorPosition.top

    return (
      <TextInput id={this.props.id} ref="input" position={position} {...this.inputFunctions}/>
    )
  },

  _renderCursor(cursorPosition, lineHeight) {
    if (this.state.selectionActive) {
      return null
    }

    // the initial render before the component is mounted has no position or lines
    if (!this.state.position || !this.state.lines || this.state.lines.length === 0) {
      return null
    }

    let cursorClasses = classNames('text-cursor', 'ui-unprintable', {
      'text-cursor-blink': !this.state.cursorMotion
    })

    let italicAtPosition = this.state.position.attributes && this.state.position.attributes[ATTR.ITALIC]
    let italicActive = this.state.activeAttributes && this.state.activeAttributes[ATTR.ITALIC]
    let italicInactive = this.state.activeAttributes && !this.state.activeAttributes[ATTR.ITALIC]

    let caretClasses = classNames('text-cursor-caret', {
      'text-cursor-italic': italicActive || (italicAtPosition && !italicInactive)
    })

    let cursorStyle = {
      opacity: 1,
      left: cursorPosition.left,
      top: cursorPosition.top
    }

/*
    cursorStyle.opacity = 0
    cursorStyle.display = 'none'
    cursorStyle.visibility = 'hidden'
*/
    let cursorHeight = Math.round(lineHeight * 10) / 10

    return (
      <div className={cursorClasses} style={cursorStyle} key="cursor" ref="cursor">
        <div className={caretClasses} style={{borderColor: 'black', height: cursorHeight}} key="caret" ref="caret"></div>
        <div className="text-cursor-top" style={{opacity: 0, display: 'none'}}></div>
        <div className="text-cursor-name" style={{opacity: 0, display: 'none'}}></div>
      </div>
    )
  },

  // TODO cursor is rendered at the document level in docs, we could do editor-level
  // TODO can do the onClick handler at at a higher level too, that way we can click outside elements e.g. before and after line ends
  render() {
    //console.trace('render')
    let lineHeight = this.lineHeight(this.props.fontSize)
    let lines = this._splitIntoLines()
    let cursorPosition = this._cursorPosition(lineHeight)
    let linesWithSelection = this._searchLinesWithSelection()

    let shouldRenderSelection = index =>
      linesWithSelection != null && index >= linesWithSelection.left && index <= linesWithSelection.right

    return (
      <div ref="editorContentsContainer">
        <div onMouseDown={this._onMouseDown} onMouseMove={this._onMouseMove}>
          {this._renderInput(cursorPosition)}
          <div className="text-contents">
            { lines.length > 0 ?
              lines.map((line, index) => this._renderLine(line, index, lineHeight, shouldRenderSelection(index)) ) :
              this._renderLine(nbsp, 0, lineHeight, false)}
          </div>
          {this._renderCursor(cursorPosition, lineHeight)}
        </div>
        {/*
        <div style={{position: 'relative', zIndex: 100, paddingTop: 30}}>
          <span>Dump:&nbsp;</span>
          <button onClick={this._dumpReplica}>Replica</button>&nbsp;
          <button onClick={this._dumpPosition}>Position</button>&nbsp;
          <button onClick={this._dumpCurrentLine}>Line</button>&nbsp;
          <button onClick={this._dumpLines}>All Lines</button>&nbsp;
          <button onClick={this._dumpSelection}>Selection</button><br/>
          <span>Force:&nbsp;</span>
          <button onClick={this._forceRender}>Render</button>&nbsp;
          <button onClick={this._forceFlow}>Flow</button><br/>
          <span>Action:&nbsp;</span>
          <button onClick={this._togglePositionEolStart}>Toggle Position EOL Start</button>&nbsp;
          <button onClick={this._reset}>Reset</button><br/>
        </div>
        */}
      </div>
    )
  }

})

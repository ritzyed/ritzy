import _ from 'lodash'
import invariant from 'react/lib/invariant'

import alt from '../core/alt'
import {ATTR, attributesEqual} from '../core/attributes'

import EditorActions from './EditorActions'
import { BASE_CHAR, EOF } from 'RichText'
import { pushArray/*, logInGroup*/ } from 'utils'
import { default as tokenizer, isWhitespace } from 'tokenizer'
import writeHtml from '../core/htmlwriter'
import writeText from '../core/textwriter'
import TextFontMetrics from '../core/TextFontMetrics'
import { charEq, charArrayEq, charId, Line, lineContainingChar } from '../core/EditorCommon'

const FLOW_DEBUG = false
const ACTION_DELETE = 'delete'
const ACTION_INSERT = 'insert'
const ACTION_ATTRIBUTES = 'attributes'

/**
 * The EditorStore is the editor's single source of truth for application state and logic related to the editor.
 * View state updates are provided to the view components in setState callbacks. This uses the Facebook Flux
 * unidirectional flow idea: actions (from the view and elsewhere) -> dispatcher -> store -> view.
 *
 * See https://facebook.github.io/flux/docs/overview.html
 */
class EditorStore {
  constructor() {
    this.bindActions(EditorActions)

    this.config = null
    this.replica = null

    this.state = {
      position: BASE_CHAR,
      positionEolStart: true,
      cursorMotion: false,
      selectionActive: false,
      remoteCursors: {},
      remoteNameReveal: [],
      focus: false,
      loaded: false
    }
  }

  initialize({config, replica}) {
    TextFontMetrics.setConfig(config)
    this.config = config
    this.replica = replica

    this.setState({focus: config.initialFocus})
  }

  initializeCursorModel({cursorSet, cursorModel}) {
    this.cursorSet = cursorSet
    this.cursorModel = cursorModel
    this._setRemoteCursorModel()
  }

  replicaInitialized() {
    this.setState({loaded: true})
    this._flow()
  }

  replicaUpdated() {
    // TODO can we determine what changed and do a more focused flow via the modifications parameter?
    this._flow()
  }

  focusInput() {
    this._delayedCursorBlink(0)
    this.setState({focus: true})
  }

  inputFocusLost() {
    this.setState({focus: false})
  }

  setRemoteCursorPosition(remoteCursor) {
    let id = remoteCursor.model._id
    // some bug in Swarm.js: sometimes the id is blank if a lot of cursor events have happened quickly in succession
    if(!id) return
    let remoteCursors = this.state.remoteCursors
    remoteCursors[id] = remoteCursor
    this.setState({remoteCursors: remoteCursors})
    this._delayedRemoteCursorNameReveal(id)
  }

  unsetRemoteCursorPosition(remoteCursor) {
    let id = remoteCursor.model._id
    // some bug in Swarm.js: sometimes the id is blank if a lot of cursor events have happened quickly in succession
    if(!id) return
    let remoteCursors = this.state.remoteCursors
    if(id in remoteCursors) {
      delete remoteCursors[id]
      this.setState({remoteCursors: remoteCursors})
    }
  }

  updateRemoteCursorModel() {
    this._setRemoteCursorModel()
  }

  revealRemoteCursorName(remoteCursor) {
    this._delayedRemoteCursorNameReveal(remoteCursor.model._id)
  }

  navigateLeft() {
    this._navigateLeftRight(-1)
  }

  navigateRight() {
    this._navigateLeftRight(1)
  }

  navigateUp() {
    this._navigateUpDown(-1)
  }

  navigateDown() {
    this._navigateUpDown(1)
  }

  navigatePageUp() {
    // assume for now a page is 10 lines
    this._navigateUpDown(-10)
  }

  navigatePageDown() {
    // assume for now a page is 10 lines
    this._navigateUpDown(10)
  }

  navigateStart() {
    this._resetPosition()
  }

  navigateStartLine() {
    if(this._emptyEditor()) {
      this._resetPosition()
      return
    }

    let {line} = lineContainingChar(this.state.lines, this.state.position, this.state.positionEolStart)
    this._setPosition(line.start, true)
  }

  navigateEnd() {
    if(this._emptyEditor()) {
      this._resetPosition()
      return
    }

    let positionEolStart = false
    if(this._lastLine().isEof()) {
      positionEolStart = true
    }
    this._setPosition(this._relativeChar(BASE_CHAR, -1), positionEolStart)
  }

  navigateEndLine() {
    if(this._emptyEditor()) {
      this._resetPosition()
      return
    }

    let {line} = lineContainingChar(this.state.lines, this.state.position, this.state.positionEolStart)
    let position
    let positionEolStart = false
    if(line.isEof() || line.chunks.length === 0) {
      position = this.state.position
      positionEolStart = true
    } else if (line.isHard()) {
      position = this._relativeChar(line.end, -1, 'limit')
    } else {
      position = line.end
    }
    this._setPosition(position, positionEolStart)
  }

  navigateWordLeft() {
    this._navigateWordLeftRight(-1)
  }

  navigateWordRight() {
    this._navigateWordLeftRight(1)
  }

  navigateToCoordinates(coordinates) {
    let {position, positionEolStart} = this._coordinatesToPosition(coordinates)

    // set the position and selection anchor if the user continues the selection later
    position = position ? position : BASE_CHAR

    this._setPosition(position, positionEolStart)
    this.setState({
      selectionAnchorChar: position
    })
  }

  selectionLeft() {
    this._selectionLeftRight(-1)
  }

  selectionRight() {
    this._selectionLeftRight(1)
  }

  selectionUp() {
    this._selectionUpDown(-1)
  }

  selectionDown() {
    this._selectionUpDown(1)
  }

  selectionPageUp() {
    // assume for now a page is 10 lines
    this._selectionUpDown(-10)
  }

  selectionPageDown() {
    // assume for now a page is 10 lines
    this._selectionUpDown(10)
  }

  selectionStart() {
    this._modifySelection(BASE_CHAR, true)
  }

  selectionStartLine() {
    let {line} = lineContainingChar(this.state.lines, this.state.position, this.state.positionEolStart)
    this._modifySelection(line.start, true)
  }

  selectionEnd() {
    let toChar = this._lastLine() && this._lastLine().isEof() ? EOF : this._relativeChar(BASE_CHAR, -1)
    this._modifySelection(toChar, toChar === EOF)
  }

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
    let {line} = lineContainingChar(this.state.lines, this.state.position, this.state.positionEolStart)
    let toChar
    let positionEolStart = false
    if(line.isEof()) {
      toChar = this.state.position
      positionEolStart = true
    } else if (line.isHard()) {
      toChar = this._relativeChar(line.end, -1, 'limit')
    } else {
      toChar = line.end
    }
    this._modifySelection(toChar, positionEolStart)
  }

  selectionWordLeft() {
    let position
    let positionEolStart
    if(this.state.position === EOF) {
      position = this._lastLine().start
      positionEolStart = true
    } else {
      position = this._wordStartRelativeTo(this.state.position)
      positionEolStart = !lineContainingChar(this.state.lines, this.state.position).endOfLine
    }
    this._modifySelection(position, positionEolStart)
  }

  selectionWordRight() {
    let position = this._wordEndRelativeTo(this.state.position)
    let endOfLine = lineContainingChar(this.state.lines, this.state.position).endOfLine

    this._modifySelection(position, !endOfLine)
  }

  selectionAll() {
    this._setPosition(BASE_CHAR)
    if(this.state.lines.length === 0) {
      this._modifySelection(EOF, true)
    } else {
      let lastChar = this._lastLine() && this._lastLine().isEof() ? EOF : this._lastLine().end
      this._modifySelection(lastChar, false)
    }
  }

  selectToCoordinates(coordinates) {
    let {position, positionEolStart} = this._coordinatesToPosition(coordinates)
    this._modifySelection(position, positionEolStart)
  }

  /**
   * Word selection follows Google Docs and Microsoft Word 2010 behavior of:
   * - selecting the word that was clicked, and one or more spaces following it
   * - if clicking at the end of a line with a soft return, the first word on the next line is selected
   * - if clicking at the end of a line with a hard return, the hard return is selected (shown as a "space")
   * - if clicking at the end of the last (empty) line, a (non-existent) hard return at EOF is selected (shown as
   *   a "space")
   */
  selectWordAtCurrentPosition() {
    if(this.state.lines.length === 0
      || lineContainingChar(this.state.lines, this.state.position, true).line.isEof()) {
      this._setPosition(this.state.position)
      this._modifySelection(EOF, true)
    } else {
      let word = this._wordRelativeTo(this.state.position)
      this._setPosition(word.start)
      this._modifySelection(word.end, false)
    }
  }

  copySelection(copyHandler) {
    let selectionChunks = this._getSelection()
    if(selectionChunks && selectionChunks.length > 0) {
      let copiedText = writeText(selectionChunks)
      let copiedHtml = writeHtml(selectionChunks)
      copyHandler(copiedText, copiedHtml, selectionChunks)
    }
  }

  insertChars({value, attributes, atPosition, reflow}) {
    return this._insertChars(value, attributes, atPosition, reflow)
  }

  insertCharsBatch(chunks) {
    let firstInsertPosition = this.state.position
    let insertPosition = null
    chunks.forEach(c => {
      insertPosition = this._insertChars(c.text, c.attrs || {}, insertPosition, false)
    })
    this._flow({start: firstInsertPosition, end: insertPosition, action: 'insert'})
  }

  eraseCharBack() {
    if(this.state.selectionActive) {
      this._eraseSelection()
    } else if(!charEq(this.state.position, BASE_CHAR)) {
      let position = this._relativeChar(this.state.position, -1)
      this.replica.rmChars(this.state.position)
      this._flow({ start: position, end: this.state.position, action: ACTION_DELETE})

      let endOfLine = lineContainingChar(this.state.lines, position).endOfLine
      this._setPosition(position, endOfLine)
    }
  }

  eraseCharForward() {
    if(this.state.selectionActive) {
      this._eraseSelection()
    } else if(!this._cursorAtEnd()) {
      let next = this._relativeChar(this.state.position, 1, 'limit')
      this.replica.rmChars(next)
      this._flow({ start: this.state.position, end: next, action: ACTION_DELETE})

      let endOfLine = lineContainingChar(this.state.lines, this.state.position).endOfLine
      this._setPosition(this.state.position, endOfLine)
    }
  }

  eraseWordBack() {
    if(this.state.selectionActive) {
      this._eraseSelection()
    } else {
      let position = this.state.position
      let start = this._wordStartRelativeTo(position)
      let end = position
      if(charEq(start, position)) {
        // beginning of word, move to the previous word
        let previousStart = this._wordStartRelativeTo(this._relativeChar(position, -1, 'limit'))
        // no previous word, nothing to delete
        if(start === previousStart) return
        end = this._wordEndRelativeTo(start)
      }

      // TODO delete at beginning of line deletes last word on previous line or last word of previous paragraph

      let wordChars = this.replica.getTextRange(start, end)
      this.replica.rmChars(wordChars)
      this._flow({ start: wordChars[0], end: wordChars[wordChars.length - 1], action: ACTION_DELETE})

      let endOfLine = lineContainingChar(this.state.lines, position).endOfLine
      this._setPosition(position, endOfLine)
    }
  }

  eraseWordForward() {
    if(this.state.selectionActive) {
      this._eraseSelection()
    } else {
      let position = this.state.position
      let options
      if(isWhitespace(this._relativeChar(position, 1, 'limit').char)) {
        options = { includeLeadingSpace: true }
      }
      let start = position
      let end = this._wordEndRelativeTo(start, options)
      if(charEq(end, position)) {
        // ending of word, move to the next word
        let nextEnd = this._wordEndRelativeTo(this._relativeChar(position, 1, 'limit'), options)
        // no next word, nothing to delete
        if(end === nextEnd) return
        start = this._wordStartRelativeTo(end, options)
      }

      // TODO delete at end of line deletes first word on next line or first word of next paragraph

      let wordChars = this.replica.getTextRange(start, end)
      this.replica.rmChars(wordChars)
      this._flow({ start: wordChars[0], end: wordChars[wordChars.length - 1], action: ACTION_DELETE})

      let endOfLine = lineContainingChar(this.state.lines, position).endOfLine
      this._setPosition(position, endOfLine)
    }
  }

  eraseSelection() {
    if(this.state.selectionActive) {
      this._eraseSelection()
    }
  }

  toggleBold() {
    this._toggleAttribute(ATTR.BOLD)
  }

  toggleItalics() {
    this._toggleAttribute(ATTR.ITALIC)
  }

  toggleUnderline() {
    this._toggleAttribute(ATTR.UNDERLINE)
  }

  toggleStrikethrough() {
    this._toggleAttribute(ATTR.STRIKETHROUGH)
  }

  toggleSuperscript() {
    this._toggleAttribute(ATTR.SUPERSCRIPT, ATTR.SUBSCRIPT)
  }

  toggleSubscript() {
    this._toggleAttribute(ATTR.SUBSCRIPT, ATTR.SUPERSCRIPT)
  }

  _insertChars(value, attributes, atPosition, reflow) {
    if(_.isUndefined(reflow)) reflow = true
    let position

    if(this.state.selectionActive) {
      position = this.state.selectionLeftChar
      this._eraseSelection()
    } else {
      if(atPosition) {
        position = atPosition
      } else {
        position = this.state.position
      }

      if(position === EOF) {
        position = this._relativeChar(EOF, -1, 'limit')
      }
    }

    if(!attributes) {
      if(this.state.selectionActive) {
        position = this.state.selectionLeftChar
        // if selection, then activeAttributes (set by command or toolbar) are set by the first selected char
        attributes = this._relativeChar(position, 1, 'limit').attributes
      } else {
        attributes = this.state.activeAttributes ?
          this.state.activeAttributes :
          this._relativeChar(position, 0).attributes // reload attributes from the replica in case they have changed
      }
    }

    this.replica.insertCharsAt(position, value, attributes)

    let relativeMove = value.length
    let newPosition = this._relativeChar(position, relativeMove)
    // if the last char is a newline, then we want to position on the start of the next line
    let newPositionEolStart = value.slice(-1) === '\n'

    if(reflow) this._flow({start: position, end: newPosition, action: ACTION_INSERT})

    this._setPosition(newPosition, newPositionEolStart)
    this.activeAttributes = attributes

    // return the new position so that multiple insertChars calls can be made in sequence
    return newPosition
  }

  _relativeChar(charOrId, relative, wrap) {
    return this.replica.getCharRelativeTo(charOrId, relative, wrap)
  }

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
   *
   * Because the algorithm to shortcut the flow before and after the changed area is complex, and can fail
   * without causing an obvious problem other than performance, debug statements are included and can be
   * enabled by setting FLOW_DEBUG to true.
   */
  _flow(modification) {
    let lines = []

    let modStartAtLine
    let startChar
    if(modification) {
      let startLineIndex = 0
      modStartAtLine = lineContainingChar(this.state.lines, modification.start, true)

      // shortcut beginning of flow, start at the line prior to the one containing the modification position
      if(modStartAtLine && modStartAtLine.index > 0) {
        startLineIndex = modStartAtLine.index - 1
        // if the previous line is a hard return, we can ignore it --> no changes on this line could affect it
        if(this.state.lines[startLineIndex].isHard()) {
          startLineIndex = modStartAtLine.index
        }
        pushArray(lines, this.state.lines.slice(0, startLineIndex))
        startChar = this.state.lines[startLineIndex].start
      } else {
        startChar = BASE_CHAR
      }
    } else {
      startChar = BASE_CHAR
    }

    if(FLOW_DEBUG) {
      let modificationSummary
      if(modification) {
        modificationSummary = modification.action + ' ' + modification.start.toString() + ' … ' + modification.end.toString()
      } else {
        modificationSummary = 'n/a'
      }
      console.group(`FLOW: modification=${modificationSummary} startChar=${startChar.toString()}`)
    }

    let newLine = false

    class CurrentWord {
      constructor() {
        this.reset()
      }

      reset() {
        this.chars = []
        this.length = 0
        this.pendingChunks = []
        this.advance = 0
        this.lineAdvance = 0
        this.attributes = null
        this.lastCharSpace = false
      }

      pushChar(c, fontSize) {
        if(!this.attributes) {
          this.attributes = c.attributes
        }
        let charAdvance = TextFontMetrics.advanceXForChars(fontSize, c)

        // don't count spaces in the word in the advance, but include it in the line advance
        if(c.char === ' ') {
          this.lastCharSpace = true
        } else {
          this.advance += charAdvance
        }
        this.lineAdvance += charAdvance
        this.chars.push(c)
        this.length++
      }

      popChar() {
        this.length--
        return this.chars.pop()
      }

      pushChunks() {
        if(this.length > 0) {
          this.pendingChunks.push({
            length: this.length,
            attributes: this.attributes
          })
        }
        this.attributes = null
        this.length = 0
      }
    }

    class CurrentLine {
      constructor() {
        this.reset()
      }

      reset() {
        this.chars = []
        this.chunks = []
        this.advance = 0
        this.start = null
        this.end = null
      }

      pushWord(word) {
        pushArray(this.chars, word.chars)

        let lastChunk
        if(this.chunks.length > 0) {
          lastChunk = this.chunks[this.chunks.length - 1]
          // if the last chunk in the line matches attributes with the first word chunk, join them to minimize chunks
          if(attributesEqual(lastChunk.attributes, word.pendingChunks[0].attributes)) {
            lastChunk.end += word.pendingChunks[0].length
            word.pendingChunks.shift()
          }
        }

        // set the start and end of each chunk, start and end are suitable for feeding to chars.slice i.e. end is exclusive
        let start = lastChunk ? lastChunk.end : 0
        word.pendingChunks.map(c => {
          c.start = start
          c.end = start + c.length
          start = c.end
          delete c.length
          return c
        })

        pushArray(this.chunks, word.pendingChunks)
        this.end = this.chars[this.chars.length - 1]
        this.advance += word.lineAdvance
        word.reset()
      }

      pushNewline(c) {
        invariant(c.char === '\n', 'pushNewline can only be called with a newline char.')
        this.chars.push(c)
        this.end = c
      }

      pushEof() {
        this.end = EOF
      }
    }

    let currentWord = new CurrentWord()
    let currentLine = new CurrentLine()

    let pushLine = (line) => {
      if(line.end) {
        let l = new Line(line.chars, line.chunks, line.start, line.end, line.advance)
        lines.push(l)
        if(FLOW_DEBUG) {
          console.debug(`PUSHED LINE (index=${lines.length - 1}): ${l.toString()}`)
        }
        newLine = true
      }
      line.reset()
      line.start = lines.length > 0 ? lines[lines.length - 1].end : BASE_CHAR
    }

    let modLineOffset

    let processChar = (c) => {
      if(newLine && modification && this.state.lines) {
        // Shortcut the flow algorithm if we know and are past the line after the modifications, and
        // any existing lines past that point match up with our current buffer (word + char). Once modLineOffset
        // is defined, we'll keep doing the search for each pushed line
        if(_.isUndefined(modLineOffset)) {
          if(modification.action === ACTION_INSERT) {
            if(lines[lines.length - 1].hasChar(modification.end)) {
              // the number of lines inserted
              modLineOffset = lines.length - modStartAtLine.index
              if(modification.end.char === '\n') modLineOffset++
            }
          } else if(modification.action === ACTION_DELETE) {
            if(lines.length > modStartAtLine.index) {
              let modEndAtLine = lineContainingChar(this.state.lines, modification.end)
              modLineOffset = modStartAtLine.index - modEndAtLine.index
            }
          } else if(modification.action === ACTION_ATTRIBUTES) {
            if(lines[lines.length - 1].hasChar(modification.end)) {
              // the number of lines less or more based on the attributes change
              let modEndAtLine = lineContainingChar(this.state.lines, modification.end)
              modLineOffset = lines.length - modEndAtLine.index
            }
          }
        }
        if(!_.isUndefined(modLineOffset)) {
          let startIndex = lines.length - modLineOffset
          let matchChars = _.clone(currentWord.chars)
          matchChars.push(c)

          if(FLOW_DEBUG) {
            console.group(`MATCH ATTEMPT: chars=[${matchChars.map(ch => ch.char === '\n' ? '↵' : ch.char).join('')}] modLineOffset=${modLineOffset}`)
          }
          let iterations = 0
          let matched = false
          for(let i = startIndex; i < this.state.lines.length && !matched; i++) {
            iterations++
            if(FLOW_DEBUG) {
              console.debug(this.state.lines[i].toString())
            }
            if(charArrayEq(matchChars, this.state.lines[i].chars.slice(0, matchChars.length))) {
              // line matches, so just grab the rest of the lines from the current state, setting start to match end
              let existingLines = this.state.lines.slice(i)
              existingLines[0].start = lines[lines.length - 1].end
              pushArray(lines, existingLines)
              matched = true
            }
            // No point in checking more if past a hard return
            if(i > startIndex && this.state.lines[i - 1].isHard()) break
          }
          if(FLOW_DEBUG) {
            console.debug(`Match ${matched ? 'succeeded' : 'failed'} in ${iterations} iterations.`)
            console.groupEnd()
          }
          if(matched) {
            return false
          }
        }
        newLine = false
      }

      if (!attributesEqual(currentWord.attributes, c.attributes)) {
        currentWord.pushChunks()
      }

      if(c.char !== '\n' && c.char !== ' ' && currentWord.lastCharSpace) {
        // new word
        currentWord.pushChunks()
        currentLine.pushWord(currentWord)
        currentWord.pushChar(c, this.config.fontSize)
      } else if(c.char === '\n') {
        // new line
        currentWord.pushChunks()
        currentLine.pushWord(currentWord)
        currentLine.pushNewline(c)
        pushLine(currentLine)
      } else {
        currentWord.pushChar(c, this.config.fontSize)
      }

      // check for line wrap
      if(currentLine.advance === 0 && currentWord.advance > this.config.width) {
        // word longer than a line, here we need to remove the last char to get us back under the line width
        let lastChar = currentWord.popChar()
        currentWord.pushChunks()
        currentLine.pushWord(currentWord)
        pushLine(currentLine)
        return processChar(lastChar)
      } else if (currentLine.advance + currentWord.advance > this.config.width) {
        pushLine(currentLine)
      }
      return true
    }

    currentLine.start = startChar
    let contentIterator = this.replica.getTextRange(startChar)[Symbol.iterator]()
    let e
    let completed = false
    while(!(e = contentIterator.next()).done && !completed) {
      if(!processChar(e.value)) {
        completed = true
      }
    }

    if(!completed) {
      currentWord.pushChunks()
      currentLine.pushWord(currentWord)
      pushLine(currentLine)

      // add an empty last line if the last line ended with a newline
      if(lines.length > 0 && lines[lines.length - 1].isHard()) {
        currentLine.pushEof()
        pushLine(currentLine)
      }
    }

    this.setState({lines: lines})

    if(FLOW_DEBUG) {
      console.groupEnd()
    }
  }

  _setRemoteCursorModel() {
    if(!this.cursorModel) return

    let updatedModel = {
      position: this.state.position.id,
      positionEolStart: this.state.positionEolStart,
      selectionActive: this.state.selectionActive,
      selectionLeftChar: this.state.selectionActive ? charId(this.state.selectionLeftChar) : null,
      selectionRightChar: this.state.selectionActive ? charId(this.state.selectionRightChar) : null,
      ms: Date.now()
    }

    // do the remote work at the end of the event queue to avoid UI latency
    setTimeout(() => {
      // add the cursor model back into the set if it is not there (reaped due to idleness?)
      if (this.cursorSet.list().findIndex(e => e._id === this.cursorModel._id) < 0) {
        this.cursorSet.addObject(this.cursorModel)
      }
      this.cursorModel.set(updatedModel)
    }, 0)
  }

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
   *   is ignored by the renderer. Since this state is often "left over" from previous calls to _setPosition
   *   it should not be trusted other than for rendering.
   * @param {boolean} [resetUpDown = true] resetUpDown Whether to reset the up/down advance
   *   and position values.
   */
  _setPosition(position, positionEolStart, resetUpDown) {
    if(_.isUndefined(positionEolStart)) positionEolStart = this.state.positionEolStart
    if(_.isUndefined(resetUpDown)) resetUpDown = true

    //console.debug('position', position, 'positionEolStart', positionEolStart, 'resetUpDown', resetUpDown)

    this.setState({
      position: position,
      positionEolStart: positionEolStart,
      selectionActive: false,
      activeAttributes: null
    })

    // todo set the line information in the state, line index, advanceX

    if(resetUpDown) {
      this.upDownAdvanceX = null
      this.upDownPositionEolStart = null
    }

    this._delayedCursorBlink()
    this._setRemoteCursorModel()
  }

  _resetPosition() {
    this._setPosition(BASE_CHAR)
  }

  _delayedCursorBlink(timeout) {
    if(_.isUndefined(timeout)) timeout = 1000

    this.setState({cursorMotion: true})

    // after timeout, reset the cursor blink, clear any previous resets to avoid unnecessary state changes
    if(this.cursorMotionTimeout) {
      clearTimeout(this.cursorMotionTimeout)
    }
    this.cursorMotionTimeout = setTimeout(() => {
      this.setState({cursorMotion: false})
      this.cursorMotionTimeout = null
    }, timeout)
  }

  _delayedRemoteCursorNameReveal(id, timeout) {
    if(_.isUndefined(timeout)) timeout = 2000

    this.state.remoteNameReveal.push(id)
    this.setState({remoteNameReveal: this.state.remoteNameReveal})

    setTimeout(() => {
      // this should never be false
      if(this.state.remoteNameReveal.length > 0) this.state.remoteNameReveal.shift()
      this.setState({remoteNameReveal: this.state.remoteNameReveal})
    }, timeout)
  }

  _lastLine() {
    return this.state.lines[this.state.lines.length - 1]
  }

  _emptyEditor() {
    return this.state.lines.length === 0
      && (this.state.position === EOF || charEq(this.state.position, BASE_CHAR))
  }

  _cursorAtEnd() {
    return this._emptyEditor()
      || charEq(this.state.position, this._lastLine().end)
      || (this._lastLine().isEof() && charEq(this.state.position, this._lastLine().start))
  }

  _getSelection() {
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
  }

  _modifySelection(toChar, positionEolStart, resetUpDown) {
    if(!toChar) return
    if(_.isUndefined(resetUpDown)) resetUpDown = true

    if(this.cursorMotionTimeout) {
      clearTimeout(this.cursorMotionTimeout)
    }

    this.setState((previousState) => {
      if(previousState.selectionActive) {
        if(charEq(previousState.selectionAnchorChar, previousState.selectionLeftChar)) {
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
            this._setPosition(previousState.selectionAnchorChar, positionEolStart)
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
            this._setPosition(previousState.selectionAnchorChar, positionEolStart)
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
    this._setRemoteCursorModel()
  }

  _charPositionRelativeToIndex(charIndex, textChars) {
    if(charIndex === 0) {
      return this._relativeChar(textChars[0], -1)
    } else {
      return textChars[charIndex - 1]
    }
  }

  _wordRelativeTo(char, options) {
    let textChars = this.replica.getTextRange(BASE_CHAR)
    let charIndex = textChars.findIndex(e => charEq(e, char)) + 1
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
  }

  _wordStartRelativeTo(char, options) {
    let textChars = this.replica.getTextRange(BASE_CHAR, char)
    let tokenRanges = tokenizer(textChars.map(c => c.char), options)
    if(tokenRanges.length > 0) {
      let start = tokenRanges[tokenRanges.length - 1].start
      return start < 1 ? BASE_CHAR : textChars[start - 1]
    } else {
      return BASE_CHAR
    }
  }

  _wordEndRelativeTo(char, options) {
    let textChars = this.replica.getTextRange(char)
    let tokenRanges = tokenizer(textChars.map(c => c.char), options)
    if(tokenRanges.length > 0) {
      let end = tokenRanges[0].end
      return textChars[end - 1]
    } else {
      return this._cursorAtEnd() ? EOF : this._relativeChar(BASE_CHAR, -1)
    }
  }

  _eraseSelection() {
    invariant(this.state.selectionActive, 'Selection must be active to erase it.')
    let position = this.state.selectionLeftChar

    let selectionChars = this.replica.getTextRange(this.state.selectionLeftChar, this.state.selectionRightChar)
    this.replica.rmChars(selectionChars)
    this._flow({ start: this.state.selectionLeftChar, end: this.state.selectionRightChar, action: ACTION_DELETE})

    let endOfLine = lineContainingChar(this.state.lines, position).endOfLine
    this._setPosition(position, endOfLine)
  }

  _navigateLeftRight(charCount) {
    let position
    if(this._emptyEditor()) {
      this._resetPosition()
      return
    }

    if(this.state.selectionActive && charCount < 0) {
      // left from left char
      position = this.state.selectionLeftChar
    } else if(this.state.selectionActive) {
      // right from right char
      position = this.state.selectionRightChar
    } else {
      position = this._relativeChar(this.state.position, charCount, 'limit')
    }
    let endOfLine = lineContainingChar(this.state.lines, position).endOfLine
    this._setPosition(position, endOfLine)
  }

  _navigateUpDown(lineCount) {
    if(this._emptyEditor()) {
      this._resetPosition()
      return
    }

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
      this._setPosition(position, positionEolStart)
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

    let targetIndex = index + lineCount
    let targetLine
    if(targetIndex < 0 || targetIndex > this.state.lines.length - 1) {
      if(targetIndex < 0 && index !== 0) {
        targetLine = this.state.lines[0]
      } else if(targetIndex > this.state.lines.length - 1 && index !== this.state.lines.length - 1) {
        targetLine = this.state.lines[this.state.lines.length - 1]
      } else {
        // nowhere to go, just unblink for a second to indicate to the user input was received
        this._delayedCursorBlink()
      }
    } else {
      targetLine = this.state.lines[targetIndex]
    }

    if(targetLine) {
      let newPosition
      if(targetLine.isEof()) {
        newPosition = targetLine.start
        positionEolStart = true
      } else {
        let chars = targetLine.chars
        let indexAndCursor = TextFontMetrics.indexAndCursorForXValue(this.config.fontSize, upDownAdvanceX, chars)
        newPosition = this._charPositionRelativeToIndex(indexAndCursor.index, chars)

        // if the new position is the start of the line, position the cursor at the start of the line
        positionEolStart = charEq(newPosition, targetLine.start)
      }
      this._setPosition(newPosition, positionEolStart, false)
    }
  }

  _navigateWordLeftRight(wordCount) {
    let position
    if(this._emptyEditor()) {
      this._resetPosition()
      return
    }

    if(this.state.selectionActive && wordCount < 0) {
      // start from one character into the selection left char so that relative to the left selected word
      position = this._relativeChar(this.state.selectionLeftChar, 1, 'limit')
    } else if(this.state.selectionActive) {
      // start from one character before the selection right char so that relative to the right selected word
      position = this._relativeChar(this.state.selectionRightChar, -1, 'limit')
    } else {
      position = this.state.position
    }
    let relativeTo = _.bind(wordCount < 0 ? this._wordStartRelativeTo : this._wordEndRelativeTo, this)
    position = relativeTo(position)
    let endOfLine = lineContainingChar(this.state.lines, position).endOfLine
    this._setPosition(position, endOfLine)
  }

  _selectionLeftRight(charCount) {
    let endOfLine = lineContainingChar(this.state.lines, this.state.position).endOfLine
    let toChar = this._relativeChar(this.state.position, charCount, 'eof')
    if(toChar === EOF && this._lastLine() && !this._lastLine().isEof()) {
      toChar = this._lastLine().end
    }
    this._modifySelection(toChar, (this.state.position === EOF && charCount === -1) || !endOfLine)
  }

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

    let targetIndex = index + lineCount
    if(targetIndex < 0) {
      this._modifySelection(BASE_CHAR, true)
      // at start of first line, reset the advanceX, and positionEolStart is now true
      this.upDownAdvanceX = 0
      this.upDownPositionEolStart = true
    } else if(targetIndex > this.state.lines.length - 1 && !this._lastLine().isEof()) {
      // trying to navigate past the last line (and last line does not have an EOF), position at end of line
      let toChar = this._relativeChar(BASE_CHAR, -1)
      this._modifySelection(toChar, false)
      // at end of last line, reset the advanceX to the end of the line, and positionEolStart is now false
      let chars = line.chars
      this.upDownAdvanceX = TextFontMetrics.advanceXForChars(this.config.fontSize, chars)
      this.upDownPositionEolStart = false
    } else if(targetIndex >= this.state.lines.length - 1 && this._lastLine().isEof()) {
      this._modifySelection(EOF, true, false)
    } else if(this._emptyEditor()) {
      this._resetPosition()
    } else {
      let targetLine = this.state.lines[targetIndex]
      let newPosition
      if(targetLine.isEof()) {
        newPosition = targetLine.start
        positionEolStart = true
      } else {
        let chars = targetLine.chars
        let indexAndCursor = TextFontMetrics.indexAndCursorForXValue(this.config.fontSize, upDownAdvanceX, chars)
        newPosition = this._charPositionRelativeToIndex(indexAndCursor.index, chars)

        // if the new position is the start of the line, position the cursor at the start of the line
        positionEolStart = charEq(newPosition, targetLine.start)
      }
      this._modifySelection(newPosition, positionEolStart, false)
    }
  }

  _toggleAttribute(attribute, exclusiveWith) {
    if(this.state.selectionActive) {
      let selectionChars = this.replica.getTextRange(this.state.selectionLeftChar, this.state.selectionRightChar)
      let charsWithAttrNotSet = selectionChars.filter(c => !c.attributes || !c.attributes[attribute])

      let setAttr = {}

      if(charsWithAttrNotSet && charsWithAttrNotSet.length > 0) {
        let attr = {}
        attr[attribute] = true

        for(let i = 0; i < charsWithAttrNotSet.length; i++) {
          let currentAttrs = charsWithAttrNotSet[i].copyOfAttributes()
          if(exclusiveWith && currentAttrs && currentAttrs[exclusiveWith]) delete currentAttrs[exclusiveWith]
          setAttr[charsWithAttrNotSet[i].id] = currentAttrs ? _.merge(currentAttrs, attr) : attr
        }
      } else {
        for(let i = 0; i < selectionChars.length; i++) {
          let currentAttrs = selectionChars[i].copyOfAttributes()
          delete currentAttrs[attribute]
          setAttr[selectionChars[i].id] = currentAttrs
        }
      }

      this.replica.setAttributes(setAttr)
      this._flow({ start: this.state.selectionLeftChar, end: this.state.selectionRightChar, action: ACTION_ATTRIBUTES})
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
        let currentAttrs = this._relativeChar(this.state.position, 0, 'limit').copyOfAttributes()
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
  }

  _lineAndAdvanceAtPosition(position, positionEolStart) {
    let {line, index, endOfLine} = lineContainingChar(this.state.lines, position, positionEolStart)
    let advanceX

    if(charEq(BASE_CHAR, position) || (endOfLine && positionEolStart)) {
      advanceX = 0
    } else {
      let chars = line.charsTo(position)
      advanceX = TextFontMetrics.advanceXForChars(this.config.fontSize, chars)
    }

    return {
      advanceX: advanceX,
      line: line,
      index: index,
      endOfLine: endOfLine
    }
  }

  _coordinatesToPosition({x, y}) {
    // TODO this works for now since all line heights are the same, but get the heights of each line dynamically
    let lineHeight = TextFontMetrics.lineHeight(this.config.fontSize)
    let lineIndex = Math.floor(y / lineHeight)

    if(lineIndex < 0) {
      // clicked before the first line, set cursor on the first line
      lineIndex = 0
    } else if (lineIndex > this.state.lines.length - 1) {
      // clicked after the last line, set cursor on the last line
      lineIndex = this.state.lines.length - 1
    }

    let line = this.state.lines[lineIndex]
    let position
    let positionEolStart

    if(!line) {
      position = BASE_CHAR
      positionEolStart = false
    } else if(line.isEof()) {
      position = line.start
      positionEolStart = true
    } else {
      let indexAndCursor = TextFontMetrics.indexAndCursorForXValue(this.config.fontSize, x, line.chars)
      position = this._charPositionRelativeToIndex(indexAndCursor.index, line.chars)

      // if clicked a line beginning (char position is end of last line) then position beginning of clicked line
      // note that the cursorX is relative to the beginning of the line
      let cursorX = indexAndCursor.cursorX
      positionEolStart = cursorX === 0 || line.isEof()
    }

    return {
      position: position,
      positionEolStart: positionEolStart
    }
  }
}

export default alt.createStore(EditorStore)

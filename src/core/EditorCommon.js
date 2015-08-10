import _ from 'lodash'

import { BASE_CHAR, EOF } from './RichText'

export function charId(charOrId) {
  return _.has(charOrId, 'id') ? charOrId.id : charOrId
}

/**
 * Determines whether two chars are the same or not.
 * @param {Char|number} charOrId1
 * @param {Char|number} charOrId2
 */
export function charEq(charOrId1, charOrId2) {
  if(charOrId1 === charOrId2) return true
  if(!charOrId1) return Object.is(charOrId1, charOrId2)
  return charId(charOrId1) === charId(charOrId2)
}

/**
 * Represents a Line which is created from the flow algorithm.
 */
export class Line {
  /**
   *
   * @param {Array} chars
   * @param {Array} chunks
   * @param {Char} start
   * @param {Char} end
   * @param {number} advance
   */
  constructor(chars, chunks, start, end, advance) {
    this.chars = chars
    this.chunks = chunks
    this.start = start
    this.end = end
    this.advance = advance
  }

  hasChar(charOrId) {
    if(!charOrId) return false
    // lazy evaluation of charIds if necessary
    if(!this._charIds) {
      this._charIds = new Set()
      this.chars.forEach(c => this._charIds.add(c.id))
    }
    return this._charIds.has(charId(charOrId))
  }

  /**
   * The first character of the line. This is not equal to "start" since start is the *position* at which the
   * first character is present (i.e. the previous char === the previous line.end).
   * @returns {Char}
   */
  first() {
    return this.chars.length > 0 ? this.chars[0] : null
  }

  toString() {
    let summary = '-'
    if(this.chars.length > 0) {
      let text = this.chars.map(c => c.char === '\n' ? '↵' : c.char)
      if(text.length > 13) {
        let textBegin = text.slice(0, 5).join('')
        let textEnd = text.slice(text.length - 5).join('')
        summary = textBegin + '…' + textEnd
      } else {
        summary = text.join('')
      }
    }
    let first = this.chars.length > 1 ? this.first().toString() : ''
    let second = this.chars.length > 2 ? this.chars[1].toString() : ''
    let summaryBegin = first.length > 0 && second.length > 0 ? first + ' ' + second : first + second
    let penultimate = this.chars.length > 1 ? this.chars[this.chars.length - 2].toString() : ''
    let summaryEnd = penultimate.length > 0 ? penultimate + ' ' + this.end.toString() : this.end.toString()
    let summaryChars = summaryBegin.length > 0 ? `${summaryBegin} … ${summaryEnd}` : summaryEnd
    return `[${summary}] start=${this.start.toString()} chars=[${summaryChars}] adv=${this.advance}}`
  }

  isHard() {
    return this.end.char === '\n'
  }

  isEof() {
    return this.end === EOF
  }

  indexOf(charOrId) {
    for (let i = 0; i < this.chars.length; i++) {
      if (charEq(this.chars[i], charOrId)) {
        return i
      }
    }
    return -1
  }

  /**
   * Obtains chars between the given char (exclusive) to the given char (inclusive). Note the
   * begin exclusivity operates differently than array slice (which is end exclusive), but corresponds
   * generally with how character ranges in the editor are used.
   * @param fromCharOrId
   * @param toCharOrId
   */
  charsBetween(fromCharOrId, toCharOrId) {
    let indexFrom = 0
    let indexTo = this.chars.length

    if(!charEq(fromCharOrId, this.start)) {
      indexFrom = this.indexOf(fromCharOrId) + 1
    }

    if(toCharOrId !== EOF && !charEq(toCharOrId, this.end)) {
      indexTo = this.indexOf(toCharOrId) + 1
    }

    return this.chars.slice(indexFrom, indexTo)
  }

  charsTo(charOrId) {
    return this.chars.slice(0, this.indexOf(charOrId) + 1)
  }
}

const EMPTY_LINE = new Line([], [], BASE_CHAR, EOF, 0)

/**
 * Determines whether two char arrays are the same or not i.e. that the arrays refer to the
 * same chars. Will also return true if both arrays are undefined or both are null.
 * @param {Char[]} cArr1
 * @param {Char[]} cArr2
 */
export function charArrayEq(cArr1, cArr2) {
  if(cArr1 === cArr2) return true
  if(!cArr1 || !_.isArray(cArr1)) return Object.is(cArr1, cArr2)
  if(cArr1.length !== cArr2.length) return false
  for(let i = 0; i < cArr1.length; i++) {
    if(!charEq(cArr1[i], cArr2[i])) return false
  }
  return true
}

/**
 * Search the given search space for the line containing the provided char. If the search
 * space is empty, an empty "virtual" line starting at BASE_CHAR and ending at EOF is returned.
 * @param searchSpace The set of lines to search.
 * @param charOrId The char or char id to search for.
 * @param  {boolean} [nextIfEol=false] If at end of line, return the next line.
 * @returns {*}
 */
export function lineContainingChar(searchSpace, charOrId, nextIfEol) {
  if(_.isUndefined(nextIfEol)) nextIfEol = false

  if(!searchSpace || searchSpace.length === 0) {
    return {
      line: EMPTY_LINE,
      index: -1,
      endOfLine: null
    }
  }

  // shortcut searches at the beginning or end of the searchSpace, this is used often and these comparisons are fast
  if(charEq(searchSpace[0].start, charOrId)) {
    return {
      line: searchSpace[0],
      index: 0,
      endOfLine: !charEq(charOrId, BASE_CHAR)
    }
  } else if(charEq(searchSpace[searchSpace.length - 1].end, charOrId)) {
    return {
      line: searchSpace[searchSpace.length - 1],
      index: searchSpace.length - 1,
      endOfLine: true
    }
  }

  for(let i = 0; i < searchSpace.length; i++) {
    let line = searchSpace[i]
    if(line.hasChar(charOrId)) {
      let index = i
      let endOfLine = charEq(charOrId, line.end)
      if(nextIfEol && endOfLine && !line.isEof() && searchSpace.length - 1 > i) {
        index++
        line = searchSpace[index]
      }

      return {
        line: line,
        index: index,
        endOfLine: endOfLine
      }
    }
  }

  return null
}

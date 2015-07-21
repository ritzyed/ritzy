import _ from 'lodash'
import bs from 'binarysearch'

import { BASE_CHAR, EOF } from './RichText'

/**
 * Search the given replica and line search space for the line containing the provided char. If the search
 * space is empty, an empty "virtual" line starting at BASE_CHAR and ending at EOF is returned.
 * @param replica The replica containing all the characters.
 * @param searchSpace The set of lines to search.
 * @param char The char to search for.
 * @param  {boolean} [nextIfEol=false] If at end of line, return the next line.
 * @returns {*}
 */
export function lineContainingChar(replica, searchSpace, char, nextIfEol) {
  if(_.isUndefined(nextIfEol)) nextIfEol = false

  if(!searchSpace || searchSpace.length === 0) {
    return {
      line: {
        isHard() {
          return false
        },
        isEof() {
          return true
        },
        chunks: [],
        start: BASE_CHAR,
        end: EOF,
        advance: 0
      },
      endOfLine: true
    }
  }

  // shortcut searches at the beginning or end of the searchSpace, this is used often and these comparisons are fast
  if(replica.charEq(searchSpace[0].start, char)) {
    return {
      line: searchSpace[0],
      index: 0,
      endOfLine: !replica.charEq(char, BASE_CHAR)
    }
  } else if(replica.charEq(searchSpace[searchSpace.length - 1].end, char)) {
    return {
      line: searchSpace[searchSpace.length - 1],
      index: searchSpace.length - 1,
      endOfLine: true
    }
  }

  let comparator = (line, c) => {
    // shortcut fast equality comparisons with line.start and line.end
    if (replica.charEq(c, line.start)) return 1
    if (replica.charEq(c, line.end)) return 0
    if (replica.compareCharPos(c, line.start) < 0) return 1
    if (replica.compareCharPos(c, line.end) > 0) return -1
    return 0
  }

  let index = bs(searchSpace, char, comparator)
  if(index === -1) {
    return null
  }
  let line = searchSpace[index]

  let endOfLine = replica.charEq(char, line.end)
  if(nextIfEol && endOfLine && !line.isEof() && searchSpace.length - 1 > index) {
    index++
    line = searchSpace[index]
  }

  return {
    line: line,
    index: index,
    endOfLine: endOfLine
  }
}

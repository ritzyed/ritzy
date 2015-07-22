import 'babel/polyfill'
import _ from 'lodash'

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
        charIds: new Set(),
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

  for(let i = 0; i < searchSpace.length; i++) {
    let line = searchSpace[i]
    if(line.charIds.has(char.id)) {
      let index = i
      let endOfLine = replica.charEq(char, line.end)
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

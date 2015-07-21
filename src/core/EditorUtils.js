import _ from 'lodash'
import bs from 'binarysearch'

import { BASE_CHAR } from './RichText'

export function lineContainingChar(replica, searchSpace, char, nextIfEol) {
  if(_.isUndefined(nextIfEol)) nextIfEol = false

  if(!searchSpace || searchSpace.length === 0) {
    return {
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

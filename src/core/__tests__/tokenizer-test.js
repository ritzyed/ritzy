import { assert } from 'chai'
import _ from 'lodash'
import tokenizer from '../tokenizer'

const rangeSub_ = function(text, ranges) {
  return _.partial((t, r, index) => {
    let range = r[index]
    return t.substring(range.start, range.end)
  }, text, ranges)
}

describe('word tokenizer', () => {
  it('tokenizes words with trailing spaces', () => {
    let text = 'A few   words, hy-phen-ated too.'
    let ranges = tokenizer(text)
    let sub = rangeSub_(text, ranges)

    assert.equal(ranges.length, 7)
    assert.equal(sub(0), 'A ')
    assert.equal(sub(1), 'few   ')
    assert.equal(sub(2), 'words')
    assert.equal(sub(3), ', ')
    assert.equal(sub(4), 'hy-phen-ated ')
    assert.equal(sub(5), 'too')
    assert.equal(sub(6), '.')

    assert.equal(true, ranges[0].isWord)
    assert.equal(true, ranges[1].isWord)
    assert.equal(true, ranges[2].isWord)
    assert.equal(false, ranges[3].isWord)
    assert.equal(true, ranges[4].isWord)
    assert.equal(true, ranges[5].isWord)
    assert.equal(false, ranges[6].isWord)
  })

  it('tokenizes words without trailing spaces', () => {
    let text = 'A few   words, hy-phen-ated too.'
    let ranges = tokenizer(text, { includeTrailingSpace: false })
    let sub = rangeSub_(text, ranges)

    assert.equal(ranges.length, 10)
    assert.equal(sub(0), 'A')
    assert.equal(sub(1), ' ')
    assert.equal(sub(2), 'few')
    assert.equal(sub(3), '   ')
    assert.equal(sub(4), 'words')
    assert.equal(sub(5), ', ')
    assert.equal(sub(6), 'hy-phen-ated')
    assert.equal(sub(7), ' ')
    assert.equal(sub(8), 'too')
    assert.equal(sub(9), '.')

    assert.equal(true, ranges[0].isWord)
    assert.equal(false, ranges[1].isWord)
    assert.equal(true, ranges[2].isWord)
    assert.equal(false, ranges[3].isWord)
    assert.equal(true, ranges[4].isWord)
    assert.equal(false, ranges[5].isWord)
    assert.equal(true, ranges[6].isWord)
    assert.equal(false, ranges[7].isWord)
    assert.equal(true, ranges[8].isWord)
    assert.equal(false, ranges[9].isWord)
  })

  it('tokenizes words with leading spaces', () => {
    let text = 'A few   words, hy-phen-ated too.'
    let ranges = tokenizer(text, { includeLeadingSpace: true })
    let sub = rangeSub_(text, ranges)

    assert.equal(ranges.length, 7)
    assert.equal(sub(0), 'A')
    assert.equal(sub(1), ' few')
    assert.equal(sub(2), '   words')
    assert.equal(sub(3), ',')
    assert.equal(sub(4), ' hy-phen-ated')
    assert.equal(sub(5), ' too')
    assert.equal(sub(6), '.')

    assert.equal(true, ranges[0].isWord)
    assert.equal(true, ranges[1].isWord)
    assert.equal(true, ranges[2].isWord)
    assert.equal(false, ranges[3].isWord)
    assert.equal(true, ranges[4].isWord)
    assert.equal(true, ranges[5].isWord)
    assert.equal(false, ranges[6].isWord)
  })

  it('tokenizes words with both leading and trailing spaces', () => {
    let text = 'A few   words, hy-phen-ated too.'
    let ranges = tokenizer(text, { includeLeadingSpace: true, includeTrailingSpace: true })
    let sub = rangeSub_(text, ranges)

    //assert.equal(ranges.length, 7)
    assert.equal(sub(0), 'A ')
    assert.equal(sub(1), ' few   ')
    assert.equal(sub(2), '   words')
    assert.equal(sub(3), ',')
    assert.equal(sub(4), ' hy-phen-ated ')
    assert.equal(sub(5), ' too')
    assert.equal(sub(6), '.')

    assert.equal(true, ranges[0].isWord)
    assert.equal(true, ranges[1].isWord)
    assert.equal(true, ranges[2].isWord)
    assert.equal(false, ranges[3].isWord)
    assert.equal(true, ranges[4].isWord)
    assert.equal(true, ranges[5].isWord)
    assert.equal(false, ranges[6].isWord)
  })

  it('tokenizes newlines as words', () => {
    let text = 'A few   \nwords,\nwith newlines.\n'
    let ranges = tokenizer(text)
    let sub = rangeSub_(text, ranges)

    //assert.equal(ranges.length, 7)
    assert.equal(sub(0), 'A ')
    assert.equal(sub(1), 'few   ')
    assert.equal(sub(2), '\n')
    assert.equal(sub(3), 'words')
    assert.equal(sub(4), ',')
    assert.equal(sub(5), '\n')
    assert.equal(sub(6), 'with ')
    assert.equal(sub(7), 'newlines')
    assert.equal(sub(8), '.')
    assert.equal(sub(9), '\n')

    assert.equal(true, ranges[0].isWord)
    assert.equal(true, ranges[1].isWord)
    assert.equal(true, ranges[2].isWord)
    assert.equal(true, ranges[3].isWord)
    assert.equal(false, ranges[4].isWord)
    assert.equal(true, ranges[5].isWord)
    assert.equal(true, ranges[6].isWord)
    assert.equal(true, ranges[7].isWord)
    assert.equal(false, ranges[8].isWord)
    assert.equal(true, ranges[9].isWord)
  })

})

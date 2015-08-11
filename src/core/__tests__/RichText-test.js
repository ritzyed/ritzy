import { assert } from 'chai'
import _ from 'lodash'
import Text, { BASE_CHAR, EOF, Char, TextData } from '../RichText'
import { charEq } from '../EditorCommon'
import Swarm from 'swarm'

Swarm.env.localhost = new Swarm.Host('test~0')

const BASE_ID = BASE_CHAR.id

const charAt_ = function(text) {
  return _.partial((t, index) => t.getCharAt(index), text)
}
const getCharRelativeTo_ = function(text) {
  return _.partial((t, charOrId, relative, allowWrap) => t.getCharRelativeTo(charOrId, relative, allowWrap), text)
}

const compareCharPos_ = function(text) {
  return _.partial((t, char1, char2) => t.compareCharPos(char1, char2), text)
}

describe('RichText TextData', () => {
  it('initializes empty text with an initial id', () => {
    let textData = new TextData()
    assert.strictEqual(textData.text(), '')
    assert.strictEqual(textData.len(), 1)  // includes initial id
    assert.deepEqual(textData.getChar(0), BASE_CHAR)
  })

  it('adds a character after the initial id', () => {
    let charId = '00001+test'
    let textData = new TextData()
    textData.insertChar(1, 'a', charId, null)

    assert.strictEqual(textData.text(), 'a')
    assert.strictEqual(textData.len(), 2)  // includes initial id
    assert.deepEqual(textData.getChar(0), BASE_CHAR)
    assert.deepEqual(textData.getChar(1), new Char(charId, 'a', null, null))
  })

  it('getting, inserting, or deleting a non-existent character throws an error', () => {
    let charId = '00001+test'
    let textData = new TextData()
    textData.insertChar(1, 'a', charId, null)

    assert.throw(() => { textData.getChar(2) },
      'Invariant Violation: Index 2 out of bounds.')
    assert.throw(() => { textData.insertChar(3, 'a', charId, null) },
      'Invariant Violation: Index 3 out of bounds.')
    assert.throw(() => { textData.deleteChar(2) },
      'Invariant Violation: Index 2 out of bounds.')
  })

  it('inserting a character before the initial data throws an error', () => {
    let charId = '00001+test'
    let textData = new TextData()

    assert.throw(() => { textData.insertChar(0, 'a', charId, null) },
      'Invariant Violation: Cannot insert at position 0.')
  })

  it('deleting the initial data throws an error', () => {
    let textData = new TextData()

    assert.throw(() => { textData.deleteChar(0) },
      'Invariant Violation: Cannot delete position 0.')
  })

  it('deletes characters and adds their ids to previous characters', () => {
    let charIds = ['00001+test', '00002+test', '00003+test']
    let textData = new TextData()
    for (let i = 1; i <= charIds.length; i++) {
      textData.insertChar(i, i.toString(), charIds[i - 1], null)
    }

    assert.strictEqual(textData.text(), '123')
    assert.strictEqual(textData.len(), 4)  // includes initial id
    assert.deepEqual(textData.getChar(1), new Char(charIds[0], '1', null, null))

    textData.deleteChar(2)
    assert.strictEqual(textData.text(), '13')
    assert.strictEqual(textData.len(), 3)  // includes initial id
    assert.deepEqual(textData.getChar(1), new Char(charIds[0], '1', ['00002+test'], null))

    textData.deleteChar(2)
    assert.strictEqual(textData.text(), '1')
    assert.strictEqual(textData.len(), 2)  // includes initial id
    assert.deepEqual(textData.getChar(1), new Char(charIds[0], '1', ['00002+test', '00003+test'], null))

    textData.deleteChar(1)
    assert.strictEqual(textData.text(), '')
    assert.strictEqual(textData.len(), 1)  // includes initial id
    assert.deepEqual(textData.getChar(0), new Char(BASE_ID, '', ['00001+test', '00002+test', '00003+test'], null))
  })
})

describe('RichText', () => {
  it('can set a new text', () => {
    let text = new Text('/Text#1')
    text.reset()
    let charAt = charAt_(text)

    text.set('abc')
    assert.strictEqual(text.data.text(), 'abc')

    text.set('abcdef')
    assert.strictEqual(text.data.text(), 'abcdef')

    text.set('def')
    assert.strictEqual(text.data.text(), 'def')
    assert.strictEqual(charAt(0).deletedIds.size, 9)
  })

  it('can set a new text with attributes', () => {
    let text = new Text('/Text#1')
    text.reset()
    let charAt = charAt_(text)

    text.set('abc', { bold: true })
    assert.strictEqual(text.data.text(), 'abc')
    for(let i = 1; i <= 3; i++) {
      assert.deepEqual(charAt(i).attributes, { bold: true }, i)
    }

    text.set('abcdef', { italic: true })
    assert.strictEqual(text.data.text(), 'abcdef')
    for(let i = 1; i <= 6; i++) {
      assert.deepEqual(charAt(i).attributes, { italic: true }, i)
    }

    text.set('def', { bold: true, underline: true } )
    assert.strictEqual(text.data.text(), 'def')
    for(let i = 1; i <= 3; i++) {
      assert.deepEqual(charAt(i).attributes, { bold: true, underline: true }, i)
    }
    assert.strictEqual(charAt(0).deletedIds.size, 9)
  })

  it('can apply deltas', () => {
    let text = new Text('/Text#1')
    text.reset()
    let charAt = charAt_(text)

    text.applyDelta([
      { insert: 'abc' }
    ])
    assert.strictEqual(text.data.text(), 'abc')

    text.applyDelta([
      { retain: 3 },
      { insert: 'def' }
    ])
    assert.strictEqual(text.data.text(), 'abcdef')

    text.applyDelta([
      { retain: 3 },
      { insert: 'DEF' },
      { retain: 3 },
      { insert: 'xyz' }
    ])
    assert.strictEqual(text.data.text(), 'abcDEFdefxyz')

    text.applyDelta([
      { delete: 3 },
      { retain: 3 },
      { delete: 3 }
    ])
    assert.strictEqual(text.data.text(), 'DEFxyz')
    assert.strictEqual(charAt(0).deletedIds.size, 3)
    assert.strictEqual(charAt(3).deletedIds.size, 3)

    // insert and delete combinations
    text.applyDelta([
      { retain: 3 },
      { insert: 'XYZ' },
      { delete: 3 }
    ])
    assert.strictEqual(text.data.text(), 'DEFXYZ')

    text.applyDelta([
      { delete: 3 },
      { retain: 3 },
      { insert: 'ABC' }
    ])
    assert.strictEqual(text.data.text(), 'XYZABC')

    text.applyDelta([
      { retain: 3 },
      { delete: 3 },
      { insert: 'MNO' }
    ])
    assert.strictEqual(text.data.text(), 'XYZMNO')
  })

  it('can obtain deltas from insert ops', () => {
    let text = new Text('/Text#1')
    text.reset()

    text.set('abcdef')

    let insert

    text.on('.insert', (spec, op) => {
      insert = op
    })

    function validate(delta) {
      text.applyDelta(delta)
      assert.deepEqual(text.deltaFromInsert(insert), delta)
    }

    validate([
      {insert: 'A'}
    ])
    assert.strictEqual(text.text(), 'Aabcdef')

    validate([
      {retain: 2},
      {insert: 'B'}
    ])
    assert.strictEqual(text.text(), 'AaBbcdef')

    validate([
      {retain: 8},
      {insert: 'G'}
    ])
    assert.strictEqual(text.text(), 'AaBbcdefG')

    validate([
      { retain: 4 },
      { insert: 'CZZ' },
      { retain: 3 },
      { insert: 'FZZ' }
    ])
    assert.strictEqual(text.text(), 'AaBbCZZcdeFZZfG')

    // handle a non-causal insert
    let ins = {}
    ins.IDNOTEXIST = 'Z'
    assert.deepEqual(text.deltaFromInsert(ins), [])
  })

  it('can obtain deltas from remove ops', () => {
    let text = new Text('/Text#1')
    text.reset()

    text.set('abcdef1234')

    let remove

    text.on('.remove', (spec, op) => {
      remove = op
    })

    function validate(delta) {
      text.applyDelta(delta)
      assert.deepEqual(text.deltaFromRemove(remove), delta)
    }

    validate([
      { delete: 1 }
    ])
    assert.strictEqual(text.text(), 'bcdef1234')

    validate([
      {retain: 2},
      {delete: 1}
    ])
    assert.strictEqual(text.text(), 'bcef1234')

    validate([
      {retain: 2},
      {delete: 2}
    ])
    assert.strictEqual(text.text(), 'bc1234')

    validate([
      {retain: 2},
      {delete: 2},
      {retain: 1},
      {delete: 1}
    ])
    assert.strictEqual(text.text(), 'bc3')

    // handle a non-causal delete
    let rm = {}
    rm.IDNOTEXIST = true
    assert.deepEqual(text.deltaFromRemove(rm), [])
  })

  it('inserts a character', () => {
    let text = new Text('/Text#1')
    text.reset()
    text.set('abcdef')

    let charOfB = text.getCharAt(2)
    let ins = {}
    ins[charOfB.id] = { value: 'B' }
    text.insert(ins)

    assert.strictEqual(text.text(), 'abBcdef')
  })

  it('inserts a character with attributes', () => {
    let text = new Text('/Text#1')
    text.reset()
    text.set('abcdef')

    let charOfB = text.getCharAt(2)
    let ins = {}
    ins[charOfB.id] = { value: 'B', attributes: { bold: true } }
    text.insert(ins)

    assert.strictEqual(text.text(), 'abBcdef')
    assert.isNull(text.getCharAt(2).attributes)
    assert.deepEqual(text.getCharAt(3).attributes, { bold: true })
    assert.isNull(text.getCharAt(4).attributes)
  })

  it('inserted character attributes are not modifiable by reference', () => {
    let text = new Text('/Text#1')
    text.reset()
    text.set('abcdef')

    let attributes = { bold: true }
    let charOfB = text.getCharAt(2)
    let ins = {}
    ins[charOfB.id] = { value: 'B', attributes: attributes }
    text.insert(ins)

    assert.deepEqual(text.getCharAt(3).attributes, { bold: true })
    assert.throw(() => { attributes.italic = true }, `Can't add property italic, object is not extensible`)
    assert.deepEqual(text.getCharAt(3).attributes, { bold: true })

    let copyOfAttributes = text.getCharAt(3).copyOfAttributes()
    assert.deepEqual(copyOfAttributes, { bold: true })
    copyOfAttributes.italic = true
    assert.deepEqual(text.getCharAt(3).attributes, { bold: true })
  })

  it('inserts multiple characters', () => {
    let text = new Text('/Text#1')
    text.reset()
    text.set('abcdef')

    let charOfB = text.getCharAt(2)
    let ins = {}
    ins[charOfB.id] = { value: 'ZZZ' }
    text.insert(ins)

    assert.strictEqual(text.text(), 'abZZZcdef')
  })

  it('inserts multiple characters with attributes', () => {
    let text = new Text('/Text#1')
    text.reset()
    text.set('abcdef')

    let charOfB = text.getCharAt(2)
    let ins = {}
    ins[charOfB.id] = { value: 'ZZZ', attributes: { bold: true } }
    text.insert(ins)

    assert.strictEqual(text.text(), 'abZZZcdef')
    assert.isNull(text.getCharAt(2).attributes)
    assert.deepEqual(text.getCharAt(3).attributes, { bold: true })
    assert.deepEqual(text.getCharAt(4).attributes, { bold: true })
    assert.deepEqual(text.getCharAt(5).attributes, { bold: true })
    assert.isNull(text.getCharAt(6).attributes)
  })

  it('deletes a character and places the deleted id into the previous character\'s deletion list', () => {
    let text = new Text('/Text#1')
    text.reset()
    text.set('abcdef')

    let charOfB = text.getCharAt(2)
    let rm = {}
    // delete b
    rm[charOfB.id] = true
    text.remove(rm)

    assert.deepEqual(text.getCharAt(1).deletedIds, new Set([charOfB.id]))
  })

  it('determines whether chars are equal', () => {
    let text = new Text('/Text#1')
    text.reset()
    text.set('abcdef')

    let charOfA = text.getCharAt(1)
    let charOfF = text.getCharAt(6)
    let undef
    let nullVar = null

    assert.isTrue(charEq(charOfA, charOfA))
    assert.isTrue(charEq(charOfA, charOfA.id))
    assert.isTrue(charEq(charOfA.id, charOfA))
    assert.isTrue(charEq(EOF, EOF))
    assert.isFalse(charEq(charOfA.id, charOfF.id))
    assert.isFalse(charEq(charOfA, charOfF))
    assert.isFalse(charEq(EOF, charOfF))
    assert.isFalse(charEq(charOfA, undef))
    assert.isFalse(charEq(charOfA, nullVar))
  })

  it('returns the proper index of characters, including or excluding deleted', () => {
    let text = new Text('/Text#1')
    text.reset()
    text.set('abcdef')

    let charOfA = text.getCharAt(1)
    let charOfB = text.getCharAt(2)
    let charOfC = text.getCharAt(3)
    let charOfF = text.getCharAt(6)

    assert.equal(text.indexOf(BASE_CHAR), 0)
    assert.equal(text.indexOf(charOfA), 1)
    assert.equal(text.indexOf(charOfB), 2)
    assert.equal(text.indexOf(charOfC), 3)
    assert.equal(text.indexOf(charOfF), 6)

    let rm = {}
    // delete b
    rm[charOfB.id] = true
    text.remove(rm)

    assert.equal(text.indexOf(BASE_CHAR), 0)
    assert.equal(text.indexOf(charOfA), 1)
    assert.equal(text.indexOf(charOfB), 1)
    assert.equal(text.indexOf(charOfB, true), 1)
    assert.equal(text.indexOf(charOfB, false), -1)
    assert.equal(text.indexOf(charOfC), 2)
    assert.equal(text.indexOf(charOfF), 5)
  })

  it('can insert a character at a previously deleted character', () => {
    let text = new Text('/Text#1')
    text.reset()
    text.set('abcdef')

    let charOfB = text.getCharAt(2)
    let rm = {}
    // delete b
    rm[charOfB.id] = true
    text.remove(rm)

    let ins = {}
    ins[charOfB.id] = { value: 'B' }
    text.insert(ins)

    assert.strictEqual(text.text(), 'aBcdef')
  })

  it('can get char information at a position', () => {
    let text = new Text('/Text#1')
    text.reset()
    text.set('abcdef')
    let charAt = charAt_(text)

    assert.deepEqual(charAt(0), BASE_CHAR)
    assert.deepEqual(charAt(1), charAt(1))
    assert.deepEqual(charAt(6), charAt(6))
  })

  it('can get char information relative to a given char or char id', () => {
    let text = new Text('/Text#1')
    text.reset()
    text.set('abcdef')
    let charAt = charAt_(text)
    let getCharRelativeTo = getCharRelativeTo_(text)

    assert.deepEqual(getCharRelativeTo(BASE_ID), BASE_CHAR)
    assert.deepEqual(getCharRelativeTo(BASE_ID, 1), charAt(1))
    assert.deepEqual(getCharRelativeTo(BASE_ID, -1), charAt(6))
    assert.deepEqual(getCharRelativeTo(charAt(1), -1), BASE_CHAR)
    assert.deepEqual(getCharRelativeTo(charAt(1), -2), charAt(6))
    assert.deepEqual(getCharRelativeTo(charAt(5), 1), charAt(6))
    assert.deepEqual(getCharRelativeTo(charAt(5), 2), BASE_CHAR)
    assert.deepEqual(getCharRelativeTo(charAt(6), 1), BASE_CHAR)
    assert.deepEqual(getCharRelativeTo(charAt(6), 2), charAt(1))

    assert.deepEqual(getCharRelativeTo(BASE_ID, -1, 'limit'), BASE_CHAR)
    assert.deepEqual(getCharRelativeTo(charAt(6), 1, 'limit'), charAt(6))

    assert.deepEqual(getCharRelativeTo(BASE_ID, -1, 'eof'), BASE_CHAR)
    assert.deepEqual(getCharRelativeTo(charAt(6), 1, 'eof'), EOF)
    assert.deepEqual(getCharRelativeTo(EOF, 1), BASE_CHAR)
    assert.deepEqual(getCharRelativeTo(EOF, 1, 'eof'), EOF)
    assert.deepEqual(getCharRelativeTo(EOF, 1, 'limit'), EOF)
    assert.deepEqual(getCharRelativeTo(EOF, -1, 'eof'), charAt(6))
    assert.deepEqual(getCharRelativeTo(EOF, -1, 'limit'), charAt(6))

    assert.throw(() => { getCharRelativeTo(BASE_ID, -1, 'error') },
      'Index out of bounds: -1')
    assert.throw(() => { getCharRelativeTo(charAt(6), 1, 'error') },
      'Index out of bounds: 7')
    assert.throw(() => { getCharRelativeTo(EOF, 1, 'error') },
      'Index out of bounds, past EOF by: 1')
  })

  it('can get char information relative to a given char or char id in an empty editor', () => {
    let text = new Text('/Text#1')
    text.reset()
    let getCharRelativeTo = getCharRelativeTo_(text)

    assert.deepEqual(getCharRelativeTo(BASE_ID), BASE_CHAR)
    assert.deepEqual(getCharRelativeTo(BASE_ID, 1), BASE_CHAR)
    assert.deepEqual(getCharRelativeTo(BASE_ID, -1), BASE_CHAR)
    assert.deepEqual(getCharRelativeTo(BASE_ID, -1, 'limit'), BASE_CHAR)
    assert.deepEqual(getCharRelativeTo(BASE_ID, -1, 'eof'), BASE_CHAR)

    assert.deepEqual(getCharRelativeTo(EOF, 1), BASE_CHAR)
    assert.deepEqual(getCharRelativeTo(EOF, -1), BASE_CHAR)
    assert.deepEqual(getCharRelativeTo(EOF, 1, 'eof'), EOF)
    assert.deepEqual(getCharRelativeTo(EOF, -1, 'eof'), BASE_CHAR)
    assert.deepEqual(getCharRelativeTo(EOF, 1, 'limit'), EOF)
    assert.deepEqual(getCharRelativeTo(EOF, -1, 'limit'), BASE_CHAR)
    assert.deepEqual(getCharRelativeTo(EOF, -1, 'error'), BASE_CHAR)

    assert.throw(() => { getCharRelativeTo(BASE_ID, 1, 'error') },
      'Index out of bounds: 1')
    assert.throw(() => { getCharRelativeTo(BASE_ID, -1, 'error') },
      'Index out of bounds: -1')
    assert.throw(() => { getCharRelativeTo(EOF, 1, 'error') },
      'Index out of bounds, past EOF by: 1')
  })

  it('can get the length including the base char', () => {
    let text = new Text('/Text#1')
    text.reset()
    text.set('abcdef')
    assert.equal(text.len(), 7)

    text.reset()
    text.set('abc')
    assert.equal(text.len(), 4)
  })

  it('can get a range of chars', () => {
    let text = new Text('/Text#1')
    text.reset()
    text.set('abcdef')
    let charAt = charAt_(text)
    let chars = c => c.char

    assert.deepEqual(text.getTextRange(BASE_ID, BASE_ID).map(chars),
      [])
    assert.deepEqual(text.getTextRange(BASE_CHAR, BASE_CHAR).map(chars),
      [])
    assert.deepEqual(text.getTextRange(charAt(1).id, charAt(1).id).map(chars),
      [])
    assert.deepEqual(text.getTextRange(BASE_ID, charAt(6).id).map(chars),
      [ 'a', 'b', 'c', 'd', 'e', 'f' ])
    assert.deepEqual(text.getTextRange(BASE_ID, charAt(3).id).map(chars),
      [ 'a', 'b', 'c' ])
    assert.deepEqual(text.getTextRange(charAt(3).id, charAt(6).id).map(chars),
      [ 'd', 'e', 'f' ])
    assert.deepEqual(text.getTextRange(BASE_ID, charAt(1).id).map(chars),
      [ 'a' ])

    // EOF end argument
    assert.deepEqual(text.getTextRange(charAt(3).id, EOF).map(chars),
      [ 'd', 'e', 'f' ])

    // optional end argument
    assert.deepEqual(text.getTextRange(BASE_ID).map(chars),
      [ 'a', 'b', 'c', 'd', 'e', 'f' ])
    assert.deepEqual(text.getTextRange(charAt(3).id).map(chars),
      [ 'd', 'e', 'f' ])
    assert.deepEqual(text.getTextRange(charAt(6).id).map(chars),
      [])
    assert.deepEqual(text.getTextRange('NOTEXIST').map(chars),
      [])

    // non-existent end argument
    assert.deepEqual(text.getTextRange(BASE_ID, 'NOTEXIST').map(chars),
      [ 'a', 'b', 'c', 'd', 'e', 'f' ])
    assert.deepEqual(text.getTextRange(charAt(3).id, 'NOTEXIST').map(chars),
      [ 'd', 'e', 'f' ])
    assert.deepEqual(text.getTextRange(charAt(6).id, 'NOTEXIST').map(chars),
      [])

    // non-existent from and to arguments
    assert.deepEqual(text.getTextRange('NOTEXIST1', 'NOTEXIST2').map(chars),
      [])

    // EOF start argument
    assert.deepEqual(text.getTextRange(EOF).map(chars),
      [])
    assert.deepEqual(text.getTextRange(EOF, 'NOTEXIST1').map(chars),
      [])

    // invariants
    assert.throw(() => { text.getTextRange(charAt(2).id, charAt(1).id) },
      'From id must precede To id.')
    assert.throw(() => { text.getTextRange('NOTEXIST', charAt(3).id) },
      'From id must precede To id.')
    assert.throw(() => { text.getTextRange(EOF, BASE_ID) },
      'From id must precede To id.')
  })

  it('can compare the position of chars', () => {
    let text = new Text('/Text#1')
    text.reset()
    text.set('abcdef')
    let charAt = charAt_(text)
    let compareCharPos = compareCharPos_(text)

    assert.strictEqual(compareCharPos(BASE_ID, BASE_ID), 0)
    assert.strictEqual(compareCharPos(BASE_CHAR, BASE_CHAR), 0)
    assert.strictEqual(compareCharPos(charAt(3), charAt(3)), 0)
    assert.strictEqual(compareCharPos(charAt(6), charAt(6)), 0)
    assert.strictEqual(compareCharPos(BASE_CHAR, charAt(1)), -1)
    assert.strictEqual(compareCharPos(charAt(3), charAt(4)), -1)
    assert.strictEqual(compareCharPos(charAt(5), charAt(6)), -1)
    assert.strictEqual(compareCharPos(charAt(1), BASE_ID), 1)
    assert.strictEqual(compareCharPos(charAt(4), charAt(3)), 1)
    assert.strictEqual(compareCharPos(charAt(6), charAt(5)), 1)
    assert.strictEqual(compareCharPos(charAt(6).id, charAt(5)), 1)
    assert.strictEqual(compareCharPos(charAt(6), charAt(5).id), 1)
    assert.strictEqual(compareCharPos(charAt(6).id, charAt(5).id), 1)
    assert.strictEqual(compareCharPos(BASE_CHAR, EOF), -1)
    assert.strictEqual(compareCharPos(charAt(6), EOF), -1)
    assert.strictEqual(compareCharPos(EOF, BASE_CHAR), 1)
    assert.strictEqual(compareCharPos(EOF, charAt(0)), 1)
    assert.strictEqual(compareCharPos(EOF, EOF), 0)

    assert.throw(() => { compareCharPos('NOTEXIST', charAt(5)) },
      'One or both chars were not found.')
    assert.throw(() => { compareCharPos(charAt(5), 'NOTEXIST') },
      'One or both chars were not found.')
    assert.throw(() => { compareCharPos({id: 'NOTEXIST'}, 'NOTEXIST') },
      'One or both chars were not found.')
  })

  it('attributes of chars are not modifiable by reference', () => {
    let text = new Text('/Text#1')
    text.reset()
    text.set('abcdef')
    let charAt = charAt_(text)

    let charOfB = charAt(2)
    let attrs = {}
    attrs[charOfB.id] = { bold: true }
    text.setAttributes(attrs)

    let char2Attrs = charAt(2).attributes
    assert.deepEqual(char2Attrs, { bold: true })
    assert.throw(() => { char2Attrs.italic = true }, `Can't add property italic, object is not extensible`)
    assert.deepEqual(charAt(2).attributes, { bold: true })
    assert.deepEqual(charAt(2).copyOfAttributes(), { bold: true })
  })

  it('can set attributes of chars', () => {
    let text = new Text('/Text#1')
    text.reset()
    text.set('abcdef')
    let charAt = charAt_(text)

    let charOfB = charAt(2)
    let charOfC = charAt(3)
    let charOfD = charAt(4)
    let attrs = {}
    attrs[charOfB.id] = { bold: true }
    attrs[charOfC.id] = { bold: true }
    attrs[charOfD.id] = { bold: true }
    text.setAttributes(attrs)

    assert.isNull(charAt(1).attributes)
    assert.deepEqual(charAt(2).attributes, { bold: true })
    assert.deepEqual(charAt(3).attributes, { bold: true })
    assert.deepEqual(charAt(4).attributes, { bold: true })
    assert.isNull(charAt(5).attributes)
    assert.isNull(charAt(6).attributes)
  })

  it('set character attributes are not modifiable by reference but are modifiable locally', () => {
    let text = new Text('/Text#1')
    text.reset()
    text.set('abcdef')
    let charAt = charAt_(text)

    let charOfB = charAt(2)
    let attrs = {}
    let attrsOfB = { bold: true }
    attrs[charOfB.id] = attrsOfB
    text.setAttributes(attrs)

    assert.deepEqual(charAt(2).attributes, { bold: true })

    // make sure our set attributes can still be changed (they are not frozen)
    attrsOfB.italic = true
    assert.deepEqual(attrsOfB, { bold: true, italic: true })
    assert.deepEqual(charAt(2).attributes, { bold: true })
  })
})

import { assert } from 'chai'
import writeText from '../textwriter'

describe('text writer', () => {
  it('outputs zero-length string with empty chunks input', () => {
    assert.equal(writeText(null), '')
    assert.equal(writeText([]), '')
  })

  it('outputs spans for text input with no newlines', () => {
    let chunks = [
      {text: 'Some text.', attrs: {}}
    ]
    assert.equal(writeText(chunks), 'Some text.')

    chunks = [
      {text: 'Some', attrs: {}},
      {text: 'text.', attrs: {}}
    ]
    assert.equal(writeText(chunks), 'Sometext.')
  })

  it('does not collapse spaces', () => {
    let chunks = [
      {text: 'Some   text', attrs: {}}
    ]
    assert.equal(writeText(chunks), 'Some   text')
  })

  it('does not escape html <, >, and & characters', () => {
    let chunks = [
      {text: 'Text with <p> and & chars.', attrs: {}}
    ]
    assert.equal(writeText(chunks), 'Text with <p> and & chars.')
  })

  it('ignores text styles', () => {
    let chunks = [
      {'text': 'bold', 'attrs': {bold: true}},
      {'text': ' italic', 'attrs': {italic: true}},
      {'text': ' underline', 'attrs': {underline: true}},
      {'text': ' superscript', 'attrs': {'superscript': true}},
      {'text': ' subscript', 'attrs': {'subscript': true}},
      {'text': ' strikethrough', 'attrs': {'strikethrough': true}},
      {'text': '.', 'attrs': {}}
    ]
    assert.equal(writeText(chunks), 'bold italic underline superscript subscript strikethrough.')
  })

  it('outputs a single space as a normal space', () => {
    let chunks = [
      {'text': ' ', 'attrs': {}}
    ]
    assert.equal(writeText(chunks), ' ')
  })

  it('outputs a non-breaking space as a non-breaking space', () => {
    let chunks = [
      {'text': '\xA0', 'attrs': {}}
    ]
    assert.equal(writeText(chunks), '\xA0')
  })

  it('outputs newlines as a newline', () => {
    let chunks = [
      {text: 'Line 1.', attrs: {bold: true}},
      {text: '\n', attrs: {}},
      {text: 'Line 2.', attrs: {italic: true}}
    ]
    assert.equal(writeText(chunks), 'Line 1.\nLine 2.')
  })

  it('outputs paragraph breaks as two newlines', () => {
    let chunks = [
      {text: 'Line 1.', attrs: {bold: true}},
      {text: '\n', attrs: {}},
      {text: '\n', attrs: {}},
      {text: 'Line 2.', attrs: {italic: true}}
    ]
    assert.equal(writeText(chunks), 'Line 1.\n\nLine 2.')
  })
})

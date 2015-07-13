import { assert } from 'chai'
import writeHtml from '../htmlwriter'
import setupdom from '../../tests/setupdom'

setupdom()

describe('html writer', () => {
  it('outputs zero-length string with empty chunks input', () => {
    assert.equal(writeHtml(null), '')
    assert.equal(writeHtml([]), '')
  })

  it('outputs spans for text input with no newlines', () => {
    let chunks = [
      {text: 'Some text.', attrs: {}}
    ]
    assert.equal(writeHtml(chunks), '<span style="white-space:pre-wrap;">Some text.</span>')

    chunks = [
      {text: 'Some', attrs: {}},
      {text: 'text.', attrs: {}}
    ]
    assert.equal(writeHtml(chunks), '<span style="white-space:pre-wrap;">Some</span><span style="white-space:pre-wrap;">text.</span>')
  })

  it('adds appropriate such that multiple spaces do not collapse', () => {
    let chunks = [
      {text: 'Some   text', attrs: {}}
    ]
    assert.equal(writeHtml(chunks), '<span style="white-space:pre-wrap;">Some   text</span>')
  })

  it('escapes html <, >, and & characters', () => {
    let chunks = [
      {text: 'Text with <p> and & chars.', attrs: {}}
    ]
    assert.equal(writeHtml(chunks), '<span style="white-space:pre-wrap;">Text with &lt;p&gt; and &amp; chars.</span>')
  })

  it('outputs styled text correctly', () => {
    let chunks = [
      {'text': 'bold', 'attrs': {bold: true}},
      {'text': ' italic', 'attrs': {italic: true}},
      {'text': ' underline', 'attrs': {underline: true}},
      {'text': ' superscript', 'attrs': {'superscript': true}},
      {'text': ' subscript', 'attrs': {'subscript': true}},
      {'text': ' strikethrough', 'attrs': {'strikethrough': true}},
      {'text': '.', 'attrs': {}}
    ]
    assert.equal(writeHtml(chunks), '<span style="font-weight:bold;white-space:pre-wrap;">bold</span><span style="font-style:italic;white-space:pre-wrap;"> italic</span><span style="text-decoration:underline;white-space:pre-wrap;"> underline</span><span style="vertical-align:super;white-space:pre-wrap;"> superscript</span><span style="vertical-align:sub;white-space:pre-wrap;"> subscript</span><span style="text-decoration:line-through;white-space:pre-wrap;"> strikethrough</span><span style="white-space:pre-wrap;">.</span>')
  })

  it('outputs a single space as a normal space', () => {
    let chunks = [
      {'text': ' ', 'attrs': {}}
    ]
    assert.equal(writeHtml(chunks), '<span style="white-space:pre-wrap;"> </span>')
  })

  it('outputs a non-breaking space with a non-breaking space entity', () => {
    let chunks = [
      {'text': '\xA0', 'attrs': {}}
    ]
    assert.equal(writeHtml(chunks), '<span style="white-space:pre-wrap;">&nbsp;</span>')
  })

  it('outputs complex styled text correctly', () => {
    let chunks = [
      {'text': 'Text with', 'attrs': {}},
      {'text': ' ', 'attrs': {}},
      {'text': 'superscript mixed with', 'attrs': {'superscript': true}},
      {'text': ' ', 'attrs': {'superscript': true}},
      {'text': 'bold', 'attrs': {'bold': true, 'superscript': true}},
      {'text': ' ', 'attrs': {'superscript': true}},
      {'text': 'and', 'attrs': {'superscript': true}},
      {'text': ' ', 'attrs': {'superscript': true}},
      {'text': 'italic', 'attrs': {'italic': true, 'superscript': true}},
      {'text': ' ', 'attrs': {'superscript': true}},
      {'text': 'and', 'attrs': {'superscript': true}},
      {'text': ' ', 'attrs': {'superscript': true}},
      {'text': 'underline', 'attrs': {'superscript': true, 'underline': true}},
      {'text': '.', 'attrs': {}}
    ]
    assert.equal(writeHtml(chunks), '<span style="white-space:pre-wrap;">Text with</span><span style="white-space:pre-wrap;"> </span><span style="vertical-align:super;white-space:pre-wrap;">superscript mixed with</span><span style="vertical-align:super;white-space:pre-wrap;"> </span><span style="vertical-align:super;font-weight:bold;white-space:pre-wrap;">bold</span><span style="vertical-align:super;white-space:pre-wrap;"> </span><span style="vertical-align:super;white-space:pre-wrap;">and</span><span style="vertical-align:super;white-space:pre-wrap;"> </span><span style="vertical-align:super;font-style:italic;white-space:pre-wrap;">italic</span><span style="vertical-align:super;white-space:pre-wrap;"> </span><span style="vertical-align:super;white-space:pre-wrap;">and</span><span style="vertical-align:super;white-space:pre-wrap;"> </span><span style="vertical-align:super;text-decoration:underline;white-space:pre-wrap;">underline</span><span style="white-space:pre-wrap;">.</span>')
  })

  it('outputs styled paragraphs when there is only one chunk between the newlines', () => {
    let chunks = [
      {text: 'Line 1.', attrs: {bold: true}},
      {text: '\n', attrs: {}},
      {text: '\n', attrs: {}},
      {text: 'Line 2.', attrs: {italic: true}}
    ]
    assert.equal(writeHtml(chunks), '<p style="font-weight:bold;white-space:pre-wrap;">Line 1.</p><p style="font-style:italic;white-space:pre-wrap;">Line 2.</p>')
  })

  it('outputs styled spans inside paragraphs when there are multiple chunks between the newlines', () => {
    let chunks = [
      {text: 'Line 1 Part 1.', attrs: {bold: true}},
      {text: 'Line 1 Part 2.', attrs: {bold: true}},
      {text: '\n', attrs: {}},
      {text: '\n', attrs: {}},
      {text: 'Line 2.', attrs: {italic: true}}
    ]
    assert.equal(writeHtml(chunks), '<p><span style="font-weight:bold;white-space:pre-wrap;">Line 1 Part 1.</span><span style="font-weight:bold;white-space:pre-wrap;">Line 1 Part 2.</span></p><p style="font-style:italic;white-space:pre-wrap;">Line 2.</p>')
  })

  it('outputs breaks when there is one newline', () => {
    let chunks = [
      {text: 'Line 1.', attrs: {}},
      {text: '\n', attrs: {}},
      {text: 'Line 2.', attrs: {}}
    ]
    assert.equal(writeHtml(chunks), '<span style="white-space:pre-wrap;">Line 1.</span><br><span style="white-space:pre-wrap;">Line 2.</span>')
  })

  it('outputs a paragraph and a break when there are three newlines', () => {
    let chunks = [
      {text: 'Line 1.', attrs: {}},
      {text: '\n', attrs: {}},
      {text: '\n', attrs: {}},
      {text: '\n', attrs: {}},
      {text: 'Line 2.', attrs: {}}
    ]
    assert.equal(writeHtml(chunks), '<p style="white-space:pre-wrap;">Line 1.</p><br><p style="white-space:pre-wrap;">Line 2.</p>')
  })

  it('outputs paragraphs when there are two newlines', () => {
    let chunks = [
      {text: 'Line 1.', attrs: {}},
      {text: '\n', attrs: {}},
      {text: '\n', attrs: {}},
      {text: 'Line 2.', attrs: {}}
    ]
    assert.equal(writeHtml(chunks), '<p style="white-space:pre-wrap;">Line 1.</p><p style="white-space:pre-wrap;">Line 2.</p>')
  })

  it('outputs styled paragraphs when there are two newlines and spans/breaks with one', () => {
    let chunks = [
      {text: 'Line 1.', attrs: {}},
      {text: '\n', attrs: {}},
      {text: '\n', attrs: {}},
      {text: 'Line 2.', attrs: {}},
      {text: '\n', attrs: {}},
      {text: 'Line 3.', attrs: {}}
    ]
    assert.equal(writeHtml(chunks), '<p style="white-space:pre-wrap;">Line 1.</p><span style="white-space:pre-wrap;">Line 2.</span><br><p style="white-space:pre-wrap;">Line 3.</p>')
  })

  it('outputs breaks when there are two newlines at the end', () => {
    let chunks = [
      {text: 'Line 1.', attrs: {}},
      {text: '\n', attrs: {}},
      {text: '\n', attrs: {}}
    ]
    assert.equal(writeHtml(chunks), '<p style="white-space:pre-wrap;">Line 1.</p><br><br>')
  })

  it('outputs breaks when there are more than two newlines at the end', () => {
    let chunks = [
      {text: 'Line 1.', attrs: {}},
      {text: '\n', attrs: {}},
      {text: '\n', attrs: {}},
      {text: '\n', attrs: {}}
    ]
    assert.equal(writeHtml(chunks), '<p style="white-space:pre-wrap;">Line 1.</p><br><br><br>')
  })
})

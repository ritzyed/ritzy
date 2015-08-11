/* eslint no-irregular-whitespace: 0 */

import { assert } from 'chai'
import parseHtml from '../htmlparser'

let hiddenContainer = () => document.getElementById('hidden-container')

describe('html parser', () => {
  // inject the HTML fixture for the tests
  before(() => {
    let fixture = '<div id="hidden-container" style="display: none"></div>'
    document.body.insertAdjacentHTML('afterbegin', fixture)
  })

  // remove the html fixture from the DOM
  after(() => {
    document.body.removeChild(hiddenContainer())
  })

  let runParse = (htmlString) => parseHtml(htmlString, hiddenContainer())

  let runTest = (htmlString, expected) => {
    let chunks = runParse(htmlString)
    assert.deepEqual(chunks, expected, `Failed with actual RESULT: ${JSON.stringify(chunks)}`)
  }

  it('removes everything from the temporary container after parsing', () => {
    let htmlString = `<p>Some <span style='font-weight: bold'>bold</span> text.</p>`

    let chunks = runParse(htmlString)
    assert(chunks.length > 0)
    assert.equal(hiddenContainer().childNodes.length, 0)
  })

  it('spaces embedded elements correctly', () => {
    let htmlString = `<p>Some <span style='font-weight: bold'>bold</span> text.</p>`

    runTest(htmlString, [
      {'text': 'Some ', 'attrs': {}},
      {'text': 'bold', 'attrs': {'bold': true}},
      {'text': ' text.', 'attrs': {}}
    ])
  })

  it('spaces embedded elements with extra whitespace afterwards correctly', () => {
    let htmlString = `<p><strong>Bold</strong> text.</p>`

    runTest(htmlString, [
      {'text': 'Bold', 'attrs': {'bold': true}},
      {'text': ' text.', 'attrs': {}}
    ])
  })

  it('spaces embedded elements with extra whitespace inside correctly', () => {
    let htmlString = `<p><strong>Bold </strong>text.</p>`

    runTest(htmlString, [
      {'text': 'Bold ', 'attrs': {'bold': true}},
      {'text': 'text.', 'attrs': {}}
    ])
  })

  it('correctly reads HTML without any top-level root element', () => {
    let htmlString = `This is some <strong>bold</strong> text.`

    runTest(htmlString, [
      {'text': 'This is some ', 'attrs': {}},
      {'text': 'bold', 'attrs': {'bold': true}},
      {'text': ' text.', 'attrs': {}}
    ])
  })

  it('keeps a single space with adjacent spans', () => {
    let htmlString = `<span>Some  </span><span>text.</span>`

    runTest(htmlString, [
      {'text': 'Some ', 'attrs': {}},
      {'text': 'text.', 'attrs': {}}
    ])
  })

  it('parses HTML entities correctly', () => {
    let htmlString = `<span>Text with &lt;p&gt; and &amp; and &quot; chars.</span>`

    runTest(htmlString, [
      {'text': 'Text with <p> and & and " chars.', 'attrs': {}}
    ])
  })

  it('ignores text with display: none', () => {
    let htmlString = `<p>Text with some <span style='display: none'>invisible</span> (invisible) text.</p>`

    runTest(htmlString, [
      {'text': 'Text with some', 'attrs': {}},
      {'text': ' (invisible) text.', 'attrs': {}}
    ])
  })

  it('ignores text with visibility: hidden', () => {
    let htmlString = `<p>Text with some <span style='visibility: hidden'>hidden</span> (hidden) text.</p>`

    runTest(htmlString, [
      {'text': 'Text with some', 'attrs': {}},
      {'text': ' (hidden) text.', 'attrs': {}}
    ])
  })

  it('outputs paragraphs separated by two newlines', () => {
    let htmlString = `<p>Paragraph 1.</p><p>Paragraph 2.</p>`

    runTest(htmlString, [
      {'text': 'Paragraph 1.\n\n', 'attrs': {}},
      {'text': 'Paragraph 2.', 'attrs': {}}
    ])
  })

  it('outputs breaks separated by one newline', () => {
    let htmlString = `<span>Span 1.</span><br/><span>Span 2.</span>`

    runTest(htmlString, [
      {'text': 'Span 1.', 'attrs': {}},
      {'text': '\n', 'attrs': {}},
      {'text': 'Span 2.', 'attrs': {}}
    ])
  })

  it('breaks with extra whitespace are separated by one newline', () => {
    let htmlString = ` <span> Span 1. </span> <br/>
<span> Span 2. </span> `

    runTest(htmlString, [
      {'text': 'Span 1.', 'attrs': {}},
      {'text': '\n', 'attrs': {}},
      {'text': 'Span 2.', 'attrs': {}}
    ])
  })

  it('handles default whitespace style line breaks', () => {
    let htmlString = `<p> Line 1.
Line 2. </p>`

    runTest(htmlString, [
      {'text': 'Line 1. Line 2.', 'attrs': {}}
    ])
  })

  it('does not collapse whitespace style=pre spaces', () => {
    let htmlString = `<p style='white-space: pre'> Paragraph 1. </p>
<p style='white-space: pre'> Paragraph 2. </p>`

    runTest(htmlString, [
      {'text': ' Paragraph 1. \n\n', 'attrs': {}},
      {'text': ' Paragraph 2. ', 'attrs': {}}
    ])
  })

  it('handles whitespace style=pre-line line breaks', () => {
    let htmlString = `<p style='white-space: pre-line'> Line 1.
Line 2. </p>`

    runTest(htmlString, [
      {'text': 'Line 1.\nLine 2.', 'attrs': {}}
    ])
  })

  it('returns an empty chunks array for empty html input', () => {
    let htmlString = ''

    let chunks = runParse(htmlString)
    assert.lengthOf(chunks, 0)
    assert.equal(hiddenContainer().childNodes.length, 0)
  })

  it('applies the standard whitespace collapse rules on plaintext with no HTML tags', () => {
    let htmlString = 'Line 1.\nLine 2.'

    runTest(htmlString, [
      {'text': 'Line 1. Line 2.', 'attrs': {}}
    ])
  })

  it('outputs the appropriate trailing whitespace with one break', () => {
    let htmlString = '<p style="white-space:pre-wrap;">Line 1</p><span style="white-space:pre-wrap;">Line 2</span><br><span style="white-space:pre-wrap;">Line 3</span><br>'

    runTest(htmlString, [
      {'text': 'Line 1\n\n', 'attrs': {}},
      {'text': 'Line 2', 'attrs': {}},
      {'text': '\n', 'attrs': {}},
      {'text': 'Line 3', 'attrs': {}},
      {'text': '\n', 'attrs': {}}
    ])
  })

  it('outputs the appropriate trailing whitespace with two breaks', () => {
    let htmlString = '<p style="white-space:pre-wrap;">Line 1</p><br><br>'

    runTest(htmlString, [
      {'text': 'Line 1', 'attrs': {}},
      {'text': '\n', 'attrs': {}},
      {'text': '\n', 'attrs': {}}
    ])
  })

  it('outputs the appropriate trailing whitespace with more than two breaks', () => {
    let htmlString = '<p style="white-space:pre-wrap;">Line 1</p><br><br><br>'

    runTest(htmlString, [
      {'text': 'Line 1', 'attrs': {}},
      {'text': '\n', 'attrs': {}},
      {'text': '\n', 'attrs': {}},
      {'text': '\n', 'attrs': {}}
    ])
  })

  it('outputs two newlines for paragraphs and one for breaks between paragraphs', () => {
    let htmlString = '<p style="white-space:pre-wrap;">Line 1</p><br><p style="white-space:pre-wrap;">Line 2</p>'

    runTest(htmlString, [
      {'text': 'Line 1\n\n', 'attrs': {}},
      {'text': '\n', 'attrs': {}},
      {'text': 'Line 2', 'attrs': {}}
    ])
  })

  // original html content
  /*
  <html>
  <body>
  <p>Text with some <strong>tagged bold text</strong>, some <span style='font-weight: bold'>styled bold text</span>.</p>
  <p>Text with some <i>tagged italic text</i>, some <span style='font-style: italic'>styled italic text</span>, as well as <em>emphasis</em>.</p>
  <p>Text with <span style='text-decoration: underline'>styled underline</span> and <u>deprecated tagged underline</u>.</p>
  <p>Text with <span style='text-decoration: line-through'>styled strikethrough</span>.</p>
  <p>Text with some <strong><i>tagged bold and italic text</i></strong>, some <span style='font-style: italic; font-weight: bold'>styled bold and italic text</span>.</p>
  <p>Text with an <span style='text-decoration: underline'>underlined mix of <span style='font-weight: bold'>bold</span> and <span style='font-style: italic'>italic</span> and <span style='text-decoration: line-through'>strikethrough</span>.</p>
  <p>Text with <span style='vertical-align: super'>styled superscript</span>, some <sup>tagged superscript</sup>, some <span style='vertical-align: sub'>styled subscript</span>, and some <sub>tagged subscript</sub> text.</p>
  <p>Text with <span style='vertical-align: super'>superscript mixed with <span style='font-weight: bold'>bold</span> and <span style='font-style: italic'>italic</span> and <span style='text-decoration: underline'>underline</span></span>.</p>
  </body>
  </html>
  */

  it('parses HTML copied from Chrome', () => {
    // html as copied from Chrome 44
    let htmlString = `<meta http-equiv="content-type" content="text/html; charset=utf-8"><p style="color: rgb(0, 0, 0); font-family: 'Times New Roman'; font-size: medium; font-style: normal; font-variant: normal; font-weight: normal; letter-spacing: normal; line-height: normal; orphans: auto; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: 1; word-spacing: 0px; -webkit-text-stroke-width: 0px;">Text with some<span class="Apple-converted-space"> </span><strong>tagged bold text</strong>, some<span class="Apple-converted-space"> </span><span style="font-weight: bold;">styled bold text</span>.</p><p style="color: rgb(0, 0, 0); font-family: 'Times New Roman'; font-size: medium; font-style: normal; font-variant: normal; font-weight: normal; letter-spacing: normal; line-height: normal; orphans: auto; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: 1; word-spacing: 0px; -webkit-text-stroke-width: 0px;">Text with some<span class="Apple-converted-space"> </span><i>tagged italic text</i>, some<span class="Apple-converted-space"> </span><span style="font-style: italic;">styled italic text</span>, as well as<span class="Apple-converted-space"> </span><em>emphasis</em>.</p><p style="color: rgb(0, 0, 0); font-family: 'Times New Roman'; font-size: medium; font-style: normal; font-variant: normal; font-weight: normal; letter-spacing: normal; line-height: normal; orphans: auto; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: 1; word-spacing: 0px; -webkit-text-stroke-width: 0px;">Text with<span class="Apple-converted-space"> </span><span style="text-decoration: underline;">styled underline</span><span class="Apple-converted-space"> </span>and<span class="Apple-converted-space"> </span><u>deprecated tagged underline</u>.</p><p style="color: rgb(0, 0, 0); font-family: 'Times New Roman'; font-size: medium; font-style: normal; font-variant: normal; font-weight: normal; letter-spacing: normal; line-height: normal; orphans: auto; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: 1; word-spacing: 0px; -webkit-text-stroke-width: 0px;">Text with<span class="Apple-converted-space"> </span><span style="text-decoration: line-through;">styled strikethrough</span>.</p><p style="color: rgb(0, 0, 0); font-family: 'Times New Roman'; font-size: medium; font-style: normal; font-variant: normal; font-weight: normal; letter-spacing: normal; line-height: normal; orphans: auto; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: 1; word-spacing: 0px; -webkit-text-stroke-width: 0px;">Text with some<span class="Apple-converted-space"> </span><strong><i>tagged bold and italic text</i></strong>, some<span class="Apple-converted-space"> </span><span style="font-style: italic; font-weight: bold;">styled bold and italic text</span>.</p><p style="color: rgb(0, 0, 0); font-family: 'Times New Roman'; font-size: medium; font-style: normal; font-variant: normal; font-weight: normal; letter-spacing: normal; line-height: normal; orphans: auto; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: 1; word-spacing: 0px; -webkit-text-stroke-width: 0px;">Text with an<span class="Apple-converted-space"> </span><span style="text-decoration: underline;">underlined mix of<span class="Apple-converted-space"> </span><span style="font-weight: bold;">bold</span><span class="Apple-converted-space"> </span>and<span class="Apple-converted-space"> </span><span style="font-style: italic;">italic</span><span class="Apple-converted-space"> </span>and<span class="Apple-converted-space"> </span><span style="text-decoration: line-through;">strikethrough</span>.</span></p><p style="color: rgb(0, 0, 0); font-family: 'Times New Roman'; font-size: medium; font-style: normal; font-variant: normal; font-weight: normal; letter-spacing: normal; line-height: normal; orphans: auto; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: 1; word-spacing: 0px; -webkit-text-stroke-width: 0px;">Text with<span class="Apple-converted-space"> </span><span style="vertical-align: super;">styled superscript</span>, some<span class="Apple-converted-space"> </span><sup>tagged superscript</sup>, some<span class="Apple-converted-space"> </span><span style="vertical-align: sub;">styled subscript</span>, and some<span class="Apple-converted-space"> </span><sub>tagged subscript</sub><span class="Apple-converted-space"> </span>text.</p><p style="color: rgb(0, 0, 0); font-family: 'Times New Roman'; font-size: medium; font-style: normal; font-variant: normal; font-weight: normal; letter-spacing: normal; line-height: normal; orphans: auto; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: 1; word-spacing: 0px; -webkit-text-stroke-width: 0px;">Text with<span class="Apple-converted-space"> </span><span style="vertical-align: super;">superscript mixed with<span class="Apple-converted-space"> </span><span style="font-weight: bold;">bold</span><span class="Apple-converted-space"> </span>and<span class="Apple-converted-space"> </span><span style="font-style: italic;">italic</span><span class="Apple-converted-space"> </span>and<span class="Apple-converted-space"> </span><span style="text-decoration: underline;">underline</span></span>.</p>`

    // NOTE that the Apple-converted-space chars above are non-breaking spaces (\u00a0) and so the chars below are as well -- should we be converting these to regular spaces??
    runTest(htmlString, [
      {'text': 'Text with some', 'attrs': {}},
      {'text': ' ', 'attrs': {}},
      {'text': 'tagged bold text', 'attrs': {'bold': true}},
      {'text': ', some', 'attrs': {}},
      {'text': ' ', 'attrs': {}},
      {'text': 'styled bold text', 'attrs': {'bold': true}},
      {'text': '.\n\n', 'attrs': {}},
      {'text': 'Text with some', 'attrs': {}},
      {'text': ' ', 'attrs': {}},
      {'text': 'tagged italic text', 'attrs': {'italic': true}},
      {'text': ', some', 'attrs': {}},
      {'text': ' ', 'attrs': {}},
      {'text': 'styled italic text', 'attrs': {'italic': true}},
      {'text': ', as well as', 'attrs': {}},
      {'text': ' ', 'attrs': {}},
      {'text': 'emphasis', 'attrs': {'italic': true}},
      {'text': '.\n\n', 'attrs': {}},
      {'text': 'Text with', 'attrs': {}},
      {'text': ' ', 'attrs': {}},
      {'text': 'styled underline', 'attrs': {'underline': true}},
      {'text': ' ', 'attrs': {}},
      {'text': 'and', 'attrs': {}},
      {'text': ' ', 'attrs': {}},
      {'text': 'deprecated tagged underline', 'attrs': {'underline': true}},
      {'text': '.\n\n', 'attrs': {}},
      {'text': 'Text with', 'attrs': {}},
      {'text': ' ', 'attrs': {}},
      {'text': 'styled strikethrough', 'attrs': {'strikethrough': true}},
      {'text': '.\n\n', 'attrs': {}},
      {'text': 'Text with some', 'attrs': {}},
      {'text': ' ', 'attrs': {}},
      {'text': 'tagged bold and italic text', 'attrs': {'bold': true, 'italic': true}},
      {'text': ', some', 'attrs': {}},
      {'text': ' ', 'attrs': {}},
      {'text': 'styled bold and italic text', 'attrs': {'bold': true, 'italic': true}},
      {'text': '.\n\n', 'attrs': {}},
      {'text': 'Text with an', 'attrs': {}},
      {'text': ' ', 'attrs': {}},
      {'text': 'underlined mix of', 'attrs': {'underline': true}},
      {'text': ' ', 'attrs': {'underline': true}},
      {'text': 'bold', 'attrs': {'bold': true, 'underline': true}},
      {'text': ' ', 'attrs': {'underline': true}},
      {'text': 'and', 'attrs': {'underline': true}},
      {'text': ' ', 'attrs': {'underline': true}},
      {'text': 'italic', 'attrs': {'italic': true, 'underline': true}},
      {'text': ' ', 'attrs': {'underline': true}},
      {'text': 'and', 'attrs': {'underline': true}},
      {'text': ' ', 'attrs': {'underline': true}},
      {'text': 'strikethrough', 'attrs': {'underline': true, 'strikethrough': true}},
      {'text': '.\n\n', 'attrs': {'underline': true}},
      {'text': 'Text with', 'attrs': {}},
      {'text': ' ', 'attrs': {}},
      {'text': 'styled superscript', 'attrs': {'superscript': true}},
      {'text': ', some', 'attrs': {}},
      {'text': ' ', 'attrs': {}},
      {'text': 'tagged superscript', 'attrs': {'superscript': true}},
      {'text': ', some', 'attrs': {}},
      {'text': ' ', 'attrs': {}},
      {'text': 'styled subscript', 'attrs': {'subscript': true}},
      {'text': ', and some', 'attrs': {}},
      {'text': ' ', 'attrs': {}},
      {'text': 'tagged subscript', 'attrs': {'subscript': true}},
      {'text': ' ', 'attrs': {}},
      {'text': 'text.\n\n', 'attrs': {}},
      {'text': 'Text with', 'attrs': {}},
      {'text': ' ', 'attrs': {}},
      {'text': 'superscript mixed with', 'attrs': {'superscript': true}},
      {'text': ' ', 'attrs': {'superscript': true}},
      {'text': 'bold', 'attrs': {'bold': true, 'superscript': true}},
      {'text': ' ', 'attrs': {'superscript': true}},
      {'text': 'and', 'attrs': {'superscript': true}},
      {'text': ' ', 'attrs': {'superscript': true}},
      {'text': 'italic', 'attrs': {'italic': true, 'superscript': true}},
      {'text': ' ', 'attrs': {'superscript': true}},
      {'text': 'and', 'attrs': {'superscript': true}},
      {'text': ' ', 'attrs': {'superscript': true}},
      {'text': 'underline', 'attrs': {'superscript': true, 'underline': true}},
      {'text': '.', 'attrs': {}}
    ])
  })

  it('parses HTML copied from Firefox', () => {
    // html as copied from Firefox 38
    let htmlString = `<p>Text with some <strong>tagged bold text</strong>, some <span style="font-weight: bold">styled bold text</span>.</p>
<p>Text with some <i>tagged italic text</i>, some <span style="font-style: italic">styled italic text</span>, as well as <em>emphasis</em>.</p>
<p>Text with <span style="text-decoration: underline">styled underline</span> and <u>deprecated tagged underline</u>.</p>
<p>Text with <span style="text-decoration: line-through">styled strikethrough</span>.</p>
<p>Text with some <strong><i>tagged bold and italic text</i></strong>, some <span style="font-style: italic; font-weight: bold">styled bold and italic text</span>.</p>
<p>Text with an <span style="text-decoration: underline">underlined mix of <span style="font-weight: bold">bold</span> and <span style="font-style: italic">italic</span> and <span style="text-decoration: line-through">strikethrough</span>.</span></p>
<p>Text with <span style="vertical-align: super">styled superscript</span>, some <sup>tagged superscript</sup>, some <span style="vertical-align: sub">styled subscript</span>, and some <sub>tagged subscript</sub> text.</p>
<p>Text with <span style="vertical-align: super">superscript mixed with <span style="font-weight: bold">bold</span> and <span style="font-style: italic">italic</span> and <span style="text-decoration: underline">underline</span></span>.</p>`

    runTest(htmlString, [
      {'text': 'Text with some ', 'attrs': {}},
      {'text': 'tagged bold text', 'attrs': {'bold': true}},
      {'text': ', some ', 'attrs': {}},
      {'text': 'styled bold text', 'attrs': {'bold': true}},
      {'text': '.\n\n', 'attrs': {}},
      {'text': 'Text with some ', 'attrs': {}},
      {'text': 'tagged italic text', 'attrs': {'italic': true}},
      {'text': ', some ', 'attrs': {}},
      {'text': 'styled italic text', 'attrs': {'italic': true}},
      {'text': ', as well as ', 'attrs': {}},
      {'text': 'emphasis', 'attrs': {'italic': true}},
      {'text': '.\n\n', 'attrs': {}},
      {'text': 'Text with ', 'attrs': {}},
      {'text': 'styled underline', 'attrs': {'underline': true}},
      {'text': ' and ', 'attrs': {}},
      {'text': 'deprecated tagged underline', 'attrs': {'underline': true}},
      {'text': '.\n\n', 'attrs': {}},
      {'text': 'Text with ', 'attrs': {}},
      {'text': 'styled strikethrough', 'attrs': {'strikethrough': true}},
      {'text': '.\n\n', 'attrs': {}},
      {'text': 'Text with some ', 'attrs': {}},
      {'text': 'tagged bold and italic text', 'attrs': {'bold': true, 'italic': true}},
      {'text': ', some ', 'attrs': {}},
      {'text': 'styled bold and italic text', 'attrs': {'bold': true, 'italic': true}},
      {'text': '.\n\n', 'attrs': {}},
      {'text': 'Text with an ', 'attrs': {}},
      {'text': 'underlined mix of ', 'attrs': {'underline': true}},
      {'text': 'bold', 'attrs': {'bold': true, 'underline': true}},
      {'text': ' and ', 'attrs': {'underline': true}},
      {'text': 'italic', 'attrs': {'italic': true, 'underline': true}},
      {'text': ' and ', 'attrs': {'underline': true}},
      {'text': 'strikethrough', 'attrs': {'underline': true, 'strikethrough': true}},
      {'text': '.\n\n', 'attrs': {'underline': true}},
      {'text': 'Text with ', 'attrs': {}},
      {'text': 'styled superscript', 'attrs': {'superscript': true}},
      {'text': ', some ', 'attrs': {}},
      {'text': 'tagged superscript', 'attrs': {'superscript': true}},
      {'text': ', some ', 'attrs': {}},
      {'text': 'styled subscript', 'attrs': {'subscript': true}},
      {'text': ', and some ', 'attrs': {}},
      {'text': 'tagged subscript', 'attrs': {'subscript': true}},
      {'text': ' text.\n\n', 'attrs': {}},
      {'text': 'Text with ', 'attrs': {}},
      {'text': 'superscript mixed with ', 'attrs': {'superscript': true}},
      {'text': 'bold', 'attrs': {'bold': true, 'superscript': true}},
      {'text': ' and ', 'attrs': {'superscript': true}},
      {'text': 'italic', 'attrs': {'italic': true, 'superscript': true}},
      {'text': ' and ', 'attrs': {'superscript': true}},
      {'text': 'underline', 'attrs': {'superscript': true, 'underline': true}},
      {'text': '.', 'attrs': {}}
    ])
  })

  it('parses HTML copied from Microsoft Word', () => {
    // html as copied from Word 2010 (yes there was some binary junk at the end)
    let htmlString = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"
xmlns="http://www.w3.org/TR/REC-html40">

<head>
<meta http-equiv=Content-Type content="text/html; charset=utf-8">
<meta name=ProgId content=Word.Document>
<meta name=Generator content="Microsoft Word 14">
<meta name=Originator content="Microsoft Word 14">
<link rel=File-List
href="file:///C:\\Users\\RAMANG~1\\AppData\\Local\\Temp\\msohtmlclip1\\01\\clip_filelist.xml">
<!--[if gte mso 9]><xml>
 <o:OfficeDocumentSettings>
  <o:AllowPNG/>
 </o:OfficeDocumentSettings>
</xml><![endif]-->
<link rel=themeData
href="file:///C:\\Users\\RAMANG~1\\AppData\\Local\\Temp\\msohtmlclip1\\01\\clip_themedata.thmx">
<link rel=colorSchemeMapping
href="file:///C:\\Users\\RAMANG~1\\AppData\\Local\\Temp\\msohtmlclip1\\01\\clip_colorschememapping.xml">
<!--[if gte mso 9]><xml>
 <w:WordDocument>
  <w:View>Normal</w:View>
  <w:Zoom>0</w:Zoom>
  <w:TrackMoves/>
  <w:TrackFormatting/>
  <w:DoNotShowPropertyChanges/>
  <w:PunctuationKerning/>
  <w:ValidateAgainstSchemas/>
  <w:SaveIfXMLInvalid>false</w:SaveIfXMLInvalid>
  <w:IgnoreMixedContent>false</w:IgnoreMixedContent>
  <w:AlwaysShowPlaceholderText>false</w:AlwaysShowPlaceholderText>
  <w:DoNotPromoteQF/>
  <w:LidThemeOther>EN-US</w:LidThemeOther>
  <w:LidThemeAsian>X-NONE</w:LidThemeAsian>
  <w:LidThemeComplexScript>X-NONE</w:LidThemeComplexScript>
  <w:Compatibility>
   <w:BreakWrappedTables/>
   <w:SnapToGridInCell/>
   <w:WrapTextWithPunct/>
   <w:UseAsianBreakRules/>
   <w:DontGrowAutofit/>
   <w:SplitPgBreakAndParaMark/>
   <w:EnableOpenTypeKerning/>
   <w:DontFlipMirrorIndents/>
   <w:OverrideTableStyleHps/>
  </w:Compatibility>
  <m:mathPr>
   <m:mathFont m:val="Cambria Math"/>
   <m:brkBin m:val="before"/>
   <m:brkBinSub m:val="&#45;-"/>
   <m:smallFrac m:val="off"/>
   <m:dispDef/>
   <m:lMargin m:val="0"/>
   <m:rMargin m:val="0"/>
   <m:defJc m:val="centerGroup"/>
   <m:wrapIndent m:val="1440"/>
   <m:intLim m:val="subSup"/>
   <m:naryLim m:val="undOvr"/>
  </m:mathPr></w:WordDocument>
</xml><![endif]--><!--[if gte mso 9]><xml>
 <w:LatentStyles DefLockedState="false" DefUnhideWhenUsed="true"
  DefSemiHidden="true" DefQFormat="false" DefPriority="99"
  LatentStyleCount="267">
  <w:LsdException Locked="false" Priority="0" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Normal"/>
  <w:LsdException Locked="false" Priority="9" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="heading 1"/>
  <w:LsdException Locked="false" Priority="9" QFormat="true" Name="heading 2"/>
  <w:LsdException Locked="false" Priority="9" QFormat="true" Name="heading 3"/>
  <w:LsdException Locked="false" Priority="9" QFormat="true" Name="heading 4"/>
  <w:LsdException Locked="false" Priority="9" QFormat="true" Name="heading 5"/>
  <w:LsdException Locked="false" Priority="9" QFormat="true" Name="heading 6"/>
  <w:LsdException Locked="false" Priority="9" QFormat="true" Name="heading 7"/>
  <w:LsdException Locked="false" Priority="9" QFormat="true" Name="heading 8"/>
  <w:LsdException Locked="false" Priority="9" QFormat="true" Name="heading 9"/>
  <w:LsdException Locked="false" Priority="39" Name="toc 1"/>
  <w:LsdException Locked="false" Priority="39" Name="toc 2"/>
  <w:LsdException Locked="false" Priority="39" Name="toc 3"/>
  <w:LsdException Locked="false" Priority="39" Name="toc 4"/>
  <w:LsdException Locked="false" Priority="39" Name="toc 5"/>
  <w:LsdException Locked="false" Priority="39" Name="toc 6"/>
  <w:LsdException Locked="false" Priority="39" Name="toc 7"/>
  <w:LsdException Locked="false" Priority="39" Name="toc 8"/>
  <w:LsdException Locked="false" Priority="39" Name="toc 9"/>
  <w:LsdException Locked="false" Priority="35" QFormat="true" Name="caption"/>
  <w:LsdException Locked="false" Priority="10" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Title"/>
  <w:LsdException Locked="false" Priority="1" Name="Default Paragraph Font"/>
  <w:LsdException Locked="false" Priority="11" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Subtitle"/>
  <w:LsdException Locked="false" Priority="22" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Strong"/>
  <w:LsdException Locked="false" Priority="20" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Emphasis"/>
  <w:LsdException Locked="false" Priority="59" SemiHidden="false"
   UnhideWhenUsed="false" Name="Table Grid"/>
  <w:LsdException Locked="false" UnhideWhenUsed="false" Name="Placeholder Text"/>
  <w:LsdException Locked="false" Priority="1" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="No Spacing"/>
  <w:LsdException Locked="false" Priority="60" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Shading"/>
  <w:LsdException Locked="false" Priority="61" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light List"/>
  <w:LsdException Locked="false" Priority="62" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Grid"/>
  <w:LsdException Locked="false" Priority="63" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 1"/>
  <w:LsdException Locked="false" Priority="64" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 2"/>
  <w:LsdException Locked="false" Priority="65" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 1"/>
  <w:LsdException Locked="false" Priority="66" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 2"/>
  <w:LsdException Locked="false" Priority="67" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 1"/>
  <w:LsdException Locked="false" Priority="68" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 2"/>
  <w:LsdException Locked="false" Priority="69" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 3"/>
  <w:LsdException Locked="false" Priority="70" SemiHidden="false"
   UnhideWhenUsed="false" Name="Dark List"/>
  <w:LsdException Locked="false" Priority="71" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Shading"/>
  <w:LsdException Locked="false" Priority="72" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful List"/>
  <w:LsdException Locked="false" Priority="73" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Grid"/>
  <w:LsdException Locked="false" Priority="60" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Shading Accent 1"/>
  <w:LsdException Locked="false" Priority="61" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light List Accent 1"/>
  <w:LsdException Locked="false" Priority="62" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Grid Accent 1"/>
  <w:LsdException Locked="false" Priority="63" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 1 Accent 1"/>
  <w:LsdException Locked="false" Priority="64" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 2 Accent 1"/>
  <w:LsdException Locked="false" Priority="65" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 1 Accent 1"/>
  <w:LsdException Locked="false" UnhideWhenUsed="false" Name="Revision"/>
  <w:LsdException Locked="false" Priority="34" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="List Paragraph"/>
  <w:LsdException Locked="false" Priority="29" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Quote"/>
  <w:LsdException Locked="false" Priority="30" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Intense Quote"/>
  <w:LsdException Locked="false" Priority="66" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 2 Accent 1"/>
  <w:LsdException Locked="false" Priority="67" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 1 Accent 1"/>
  <w:LsdException Locked="false" Priority="68" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 2 Accent 1"/>
  <w:LsdException Locked="false" Priority="69" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 3 Accent 1"/>
  <w:LsdException Locked="false" Priority="70" SemiHidden="false"
   UnhideWhenUsed="false" Name="Dark List Accent 1"/>
  <w:LsdException Locked="false" Priority="71" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Shading Accent 1"/>
  <w:LsdException Locked="false" Priority="72" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful List Accent 1"/>
  <w:LsdException Locked="false" Priority="73" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Grid Accent 1"/>
  <w:LsdException Locked="false" Priority="60" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Shading Accent 2"/>
  <w:LsdException Locked="false" Priority="61" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light List Accent 2"/>
  <w:LsdException Locked="false" Priority="62" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Grid Accent 2"/>
  <w:LsdException Locked="false" Priority="63" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 1 Accent 2"/>
  <w:LsdException Locked="false" Priority="64" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 2 Accent 2"/>
  <w:LsdException Locked="false" Priority="65" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 1 Accent 2"/>
  <w:LsdException Locked="false" Priority="66" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 2 Accent 2"/>
  <w:LsdException Locked="false" Priority="67" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 1 Accent 2"/>
  <w:LsdException Locked="false" Priority="68" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 2 Accent 2"/>
  <w:LsdException Locked="false" Priority="69" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 3 Accent 2"/>
  <w:LsdException Locked="false" Priority="70" SemiHidden="false"
   UnhideWhenUsed="false" Name="Dark List Accent 2"/>
  <w:LsdException Locked="false" Priority="71" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Shading Accent 2"/>
  <w:LsdException Locked="false" Priority="72" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful List Accent 2"/>
  <w:LsdException Locked="false" Priority="73" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Grid Accent 2"/>
  <w:LsdException Locked="false" Priority="60" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Shading Accent 3"/>
  <w:LsdException Locked="false" Priority="61" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light List Accent 3"/>
  <w:LsdException Locked="false" Priority="62" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Grid Accent 3"/>
  <w:LsdException Locked="false" Priority="63" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 1 Accent 3"/>
  <w:LsdException Locked="false" Priority="64" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 2 Accent 3"/>
  <w:LsdException Locked="false" Priority="65" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 1 Accent 3"/>
  <w:LsdException Locked="false" Priority="66" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 2 Accent 3"/>
  <w:LsdException Locked="false" Priority="67" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 1 Accent 3"/>
  <w:LsdException Locked="false" Priority="68" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 2 Accent 3"/>
  <w:LsdException Locked="false" Priority="69" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 3 Accent 3"/>
  <w:LsdException Locked="false" Priority="70" SemiHidden="false"
   UnhideWhenUsed="false" Name="Dark List Accent 3"/>
  <w:LsdException Locked="false" Priority="71" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Shading Accent 3"/>
  <w:LsdException Locked="false" Priority="72" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful List Accent 3"/>
  <w:LsdException Locked="false" Priority="73" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Grid Accent 3"/>
  <w:LsdException Locked="false" Priority="60" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Shading Accent 4"/>
  <w:LsdException Locked="false" Priority="61" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light List Accent 4"/>
  <w:LsdException Locked="false" Priority="62" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Grid Accent 4"/>
  <w:LsdException Locked="false" Priority="63" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 1 Accent 4"/>
  <w:LsdException Locked="false" Priority="64" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 2 Accent 4"/>
  <w:LsdException Locked="false" Priority="65" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 1 Accent 4"/>
  <w:LsdException Locked="false" Priority="66" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 2 Accent 4"/>
  <w:LsdException Locked="false" Priority="67" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 1 Accent 4"/>
  <w:LsdException Locked="false" Priority="68" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 2 Accent 4"/>
  <w:LsdException Locked="false" Priority="69" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 3 Accent 4"/>
  <w:LsdException Locked="false" Priority="70" SemiHidden="false"
   UnhideWhenUsed="false" Name="Dark List Accent 4"/>
  <w:LsdException Locked="false" Priority="71" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Shading Accent 4"/>
  <w:LsdException Locked="false" Priority="72" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful List Accent 4"/>
  <w:LsdException Locked="false" Priority="73" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Grid Accent 4"/>
  <w:LsdException Locked="false" Priority="60" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Shading Accent 5"/>
  <w:LsdException Locked="false" Priority="61" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light List Accent 5"/>
  <w:LsdException Locked="false" Priority="62" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Grid Accent 5"/>
  <w:LsdException Locked="false" Priority="63" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 1 Accent 5"/>
  <w:LsdException Locked="false" Priority="64" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 2 Accent 5"/>
  <w:LsdException Locked="false" Priority="65" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 1 Accent 5"/>
  <w:LsdException Locked="false" Priority="66" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 2 Accent 5"/>
  <w:LsdException Locked="false" Priority="67" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 1 Accent 5"/>
  <w:LsdException Locked="false" Priority="68" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 2 Accent 5"/>
  <w:LsdException Locked="false" Priority="69" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 3 Accent 5"/>
  <w:LsdException Locked="false" Priority="70" SemiHidden="false"
   UnhideWhenUsed="false" Name="Dark List Accent 5"/>
  <w:LsdException Locked="false" Priority="71" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Shading Accent 5"/>
  <w:LsdException Locked="false" Priority="72" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful List Accent 5"/>
  <w:LsdException Locked="false" Priority="73" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Grid Accent 5"/>
  <w:LsdException Locked="false" Priority="60" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Shading Accent 6"/>
  <w:LsdException Locked="false" Priority="61" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light List Accent 6"/>
  <w:LsdException Locked="false" Priority="62" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Grid Accent 6"/>
  <w:LsdException Locked="false" Priority="63" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 1 Accent 6"/>
  <w:LsdException Locked="false" Priority="64" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 2 Accent 6"/>
  <w:LsdException Locked="false" Priority="65" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 1 Accent 6"/>
  <w:LsdException Locked="false" Priority="66" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 2 Accent 6"/>
  <w:LsdException Locked="false" Priority="67" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 1 Accent 6"/>
  <w:LsdException Locked="false" Priority="68" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 2 Accent 6"/>
  <w:LsdException Locked="false" Priority="69" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 3 Accent 6"/>
  <w:LsdException Locked="false" Priority="70" SemiHidden="false"
   UnhideWhenUsed="false" Name="Dark List Accent 6"/>
  <w:LsdException Locked="false" Priority="71" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Shading Accent 6"/>
  <w:LsdException Locked="false" Priority="72" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful List Accent 6"/>
  <w:LsdException Locked="false" Priority="73" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Grid Accent 6"/>
  <w:LsdException Locked="false" Priority="19" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Subtle Emphasis"/>
  <w:LsdException Locked="false" Priority="21" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Intense Emphasis"/>
  <w:LsdException Locked="false" Priority="31" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Subtle Reference"/>
  <w:LsdException Locked="false" Priority="32" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Intense Reference"/>
  <w:LsdException Locked="false" Priority="33" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Book Title"/>
  <w:LsdException Locked="false" Priority="37" Name="Bibliography"/>
  <w:LsdException Locked="false" Priority="39" QFormat="true" Name="TOC Heading"/>
 </w:LatentStyles>
</xml><![endif]-->
<style>
<!--
 /* Style Definitions */
 p.MsoNormal, li.MsoNormal, div.MsoNormal
  {mso-style-unhide:no;
  mso-style-qformat:yes;
  mso-style-parent:"";
  margin:0in;
  margin-bottom:.0001pt;
  mso-pagination:widow-orphan;
  font-size:12.0pt;
  font-family:"Times New Roman","serif";
  mso-fareast-font-family:"Times New Roman";
  mso-fareast-theme-font:minor-fareast;}
p
  {mso-style-noshow:yes;
  mso-style-priority:99;
  mso-margin-top-alt:auto;
  margin-right:0in;
  mso-margin-bottom-alt:auto;
  margin-left:0in;
  mso-pagination:widow-orphan;
  font-size:12.0pt;
  font-family:"Times New Roman","serif";
  mso-fareast-font-family:"Times New Roman";
  mso-fareast-theme-font:minor-fareast;}
.MsoChpDefault
  {mso-style-type:export-only;
  mso-default-props:yes;
  font-size:10.0pt;
  mso-ansi-font-size:10.0pt;
  mso-bidi-font-size:10.0pt;}
@page WordSection1
  {size:8.5in 11.0in;
  margin:1.0in 1.0in 1.0in 1.0in;
  mso-header-margin:.5in;
  mso-footer-margin:.5in;
  mso-paper-source:0;}
div.WordSection1
  {page:WordSection1;}
-->
</style>
<!--[if gte mso 10]>
<style>
 /* Style Definitions */
 table.MsoNormalTable
  {mso-style-name:"Table Normal";
  mso-tstyle-rowband-size:0;
  mso-tstyle-colband-size:0;
  mso-style-noshow:yes;
  mso-style-priority:99;
  mso-style-parent:"";
  mso-padding-alt:0in 5.4pt 0in 5.4pt;
  mso-para-margin:0in;
  mso-para-margin-bottom:.0001pt;
  mso-pagination:widow-orphan;
  font-size:10.0pt;
  font-family:"Times New Roman","serif";}
</style>
<![endif]-->
</head>

<body lang=EN-US style='tab-interval:.5in'>
<!--StartFragment-->

<p>Text with some <strong>tagged bold text</strong>, some <b>styled bold text</b>.<o:p></o:p></p>

<p>Text with some <i>tagged italic text</i>, some <i>styled italic text</i>, as
well as <em>emphasis</em>.<o:p></o:p></p>

<p>Text with <u>styled underline</u> and <u>deprecated tagged underline</u>.<o:p></o:p></p>

<p>Text with <s>styled strikethrough</s>.<o:p></o:p></p>

<p>Text with some <strong><i>tagged bold and italic text</i></strong>, some <b><i>styled
bold and italic text</i></b>.<o:p></o:p></p>

<p>Text with an <u>underlined mix of <b>bold</b> and <i>italic</i> and <s>strikethrough</s>.<o:p></o:p></u></p>

<p>Text with <sup>styled superscript</sup>, some <sup>tagged superscript</sup>,
some <sub>styled subscript</sub>, and some <sub>tagged subscript</sub> text.<o:p></o:p></p>

<p>Text with <sup>superscript mixed with <b>bold</b> and <i>italic</i> and <u>underline</u></sup>.<u><o:p></o:p></u></p>

<!--EndFragment-->
</body>

</html>`

    runTest(htmlString, [
      {'text': 'Text with some ', 'attrs': {}},
      {'text': 'tagged bold text', 'attrs': {'bold': true}},
      {'text': ', some ', 'attrs': {}},
      {'text': 'styled bold text', 'attrs': {'bold': true}},
      {'text': '.\n\n', 'attrs': {}},
      {'text': 'Text with some ', 'attrs': {}},
      {'text': 'tagged italic text', 'attrs': {'italic': true}},
      {'text': ', some ', 'attrs': {}},
      {'text': 'styled italic text', 'attrs': {'italic': true}},
      {'text': ', as well as ', 'attrs': {}},
      {'text': 'emphasis', 'attrs': {'italic': true}},
      {'text': '.\n\n', 'attrs': {}},
      {'text': 'Text with ', 'attrs': {}},
      {'text': 'styled underline', 'attrs': {'underline': true}},
      {'text': ' and ', 'attrs': {}},
      {'text': 'deprecated tagged underline', 'attrs': {'underline': true}},
      {'text': '.\n\n', 'attrs': {}},
      {'text': 'Text with ', 'attrs': {}},
      {'text': 'styled strikethrough', 'attrs': {'strikethrough': true}},
      {'text': '.\n\n', 'attrs': {}},
      {'text': 'Text with some ', 'attrs': {}},
      {'text': 'tagged bold and italic text', 'attrs': {'bold': true, 'italic': true}},
      {'text': ', some ', 'attrs': {}},
      {'text': 'styled bold and italic text', 'attrs': {'bold': true, 'italic': true}},
      {'text': '.\n\n', 'attrs': {}},
      {'text': 'Text with an ', 'attrs': {}},
      {'text': 'underlined mix of ', 'attrs': {'underline': true}},
      {'text': 'bold', 'attrs': {'bold': true, 'underline': true}},
      {'text': ' and ', 'attrs': {'underline': true}},
      {'text': 'italic', 'attrs': {'italic': true, 'underline': true}},
      {'text': ' and ', 'attrs': {'underline': true}},
      {'text': 'strikethrough', 'attrs': {'underline': true, 'strikethrough': true}},
      {'text': '.\n\n', 'attrs': {'underline': true}},
      {'text': 'Text with ', 'attrs': {}},
      {'text': 'styled superscript', 'attrs': {'superscript': true}},
      {'text': ', some ', 'attrs': {}},
      {'text': 'tagged superscript', 'attrs': {'superscript': true}},
      {'text': ', some ', 'attrs': {}},
      {'text': 'styled subscript', 'attrs': {'subscript': true}},
      {'text': ', and some ', 'attrs': {}},
      {'text': 'tagged subscript', 'attrs': {'subscript': true}},
      {'text': ' text.\n\n', 'attrs': {}},
      {'text': 'Text with ', 'attrs': {}},
      {'text': 'superscript mixed with ', 'attrs': {'superscript': true}},
      {'text': 'bold', 'attrs': {'bold': true, 'superscript': true}},
      {'text': ' and ', 'attrs': {'superscript': true}},
      {'text': 'italic', 'attrs': {'italic': true, 'superscript': true}},
      {'text': ' and ', 'attrs': {'superscript': true}},
      {'text': 'underline', 'attrs': {'superscript': true, 'underline': true}},
      {'text': '.', 'attrs': {}}
    ])
  })

  it('parses HTML copied from Google Docs', () => {
    // Google Docs inserts these weird <b> tags around the copied content with font-weight: normal and does some weird stuff with p and br tags
    let htmlString = `<meta http-equiv="content-type" content="text/html; charset=utf-8"><meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-d3d4594f-7a3d-ed78-402a-41a239914301"><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">Text with some </span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:bold;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">tagged bold text</span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">, some </span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:bold;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">styled bold text</span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">.</span></p><br><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">Text with some </span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:italic;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">tagged italic text</span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">, some </span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:italic;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">styled italic text</span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">, as well as </span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:italic;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">emphasis</span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">.</span></p><br><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">Text with </span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:underline;vertical-align:baseline;white-space:pre-wrap;">styled underline</span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;"> and </span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:underline;vertical-align:baseline;white-space:pre-wrap;">deprecated tagged underline</span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">.</span></p><br><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">Text with </span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:line-through;vertical-align:baseline;white-space:pre-wrap;">styled strikethrough</span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">.</span></p><br><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">Text with some </span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:bold;font-style:italic;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">tagged bold and italic text</span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">, some </span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:bold;font-style:italic;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">styled bold and italic text</span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">.</span></p><br><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">Text with an </span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:underline;vertical-align:baseline;white-space:pre-wrap;">underlined mix of </span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:bold;font-style:normal;font-variant:normal;text-decoration:underline;vertical-align:baseline;white-space:pre-wrap;">bold</span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:underline;vertical-align:baseline;white-space:pre-wrap;"> and </span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:italic;font-variant:normal;text-decoration:underline;vertical-align:baseline;white-space:pre-wrap;">italic</span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:underline;vertical-align:baseline;white-space:pre-wrap;"> and </span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:underline line-through;vertical-align:baseline;white-space:pre-wrap;">strikethrough</span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:underline;vertical-align:baseline;white-space:pre-wrap;">.</span></p><br><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">Text with </span><span style="font-size:14.399999999999999px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:super;white-space:pre-wrap;">styled superscript</span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">, some </span><span style="font-size:7.999999999999999px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:super;white-space:pre-wrap;">tagged superscript</span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">, some </span><span style="font-size:14.399999999999999px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:sub;white-space:pre-wrap;">styled subscript</span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">, and some </span><span style="font-size:7.999999999999999px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:sub;white-space:pre-wrap;">tagged subscript</span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;"> text.</span></p><br><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">Text with </span><span style="font-size:14.399999999999999px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:super;white-space:pre-wrap;">superscript mixed with </span><span style="font-size:14.399999999999999px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:bold;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:super;white-space:pre-wrap;">bold</span><span style="font-size:14.399999999999999px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:super;white-space:pre-wrap;"> and </span><span style="font-size:14.399999999999999px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:italic;font-variant:normal;text-decoration:none;vertical-align:super;white-space:pre-wrap;">italic</span><span style="font-size:14.399999999999999px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:super;white-space:pre-wrap;"> and </span><span style="font-size:14.399999999999999px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:underline;vertical-align:super;white-space:pre-wrap;">underline</span><span style="font-size:13.333333333333332px;font-family:'Open Sans';color:#000000;background-color:transparent;font-weight:normal;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">.</span></p></b><br class="Apple-interchange-newline">`

    runTest(htmlString, [
      {'text': 'Text with some ', 'attrs': {}},
      {'text': 'tagged bold text', 'attrs': {'bold': true}},
      {'text': ', some ', 'attrs': {}},
      {'text': 'styled bold text', 'attrs': {'bold': true}},
      {'text': '.\n', 'attrs': {}},
      {'text': '\n', 'attrs': {}},
      {'text': 'Text with some ', 'attrs': {}},
      {'text': 'tagged italic text', 'attrs': {'italic': true}},
      {'text': ', some ', 'attrs': {}},
      {'text': 'styled italic text', 'attrs': {'italic': true}},
      {'text': ', as well as ', 'attrs': {}},
      {'text': 'emphasis', 'attrs': {'italic': true}},
      {'text': '.\n', 'attrs': {}},
      {'text': '\n', 'attrs': {}},
      {'text': 'Text with ', 'attrs': {}},
      {'text': 'styled underline', 'attrs': {'underline': true}},
      {'text': ' and ', 'attrs': {}},
      {'text': 'deprecated tagged underline', 'attrs': {'underline': true}},
      {'text': '.\n', 'attrs': {}},
      {'text': '\n', 'attrs': {}},
      {'text': 'Text with ', 'attrs': {}},
      {'text': 'styled strikethrough', 'attrs': {'strikethrough': true}},
      {'text': '.\n', 'attrs': {}},
      {'text': '\n', 'attrs': {}},
      {'text': 'Text with some ', 'attrs': {}},
      {'text': 'tagged bold and italic text', 'attrs': {'bold': true, 'italic': true}},
      {'text': ', some ', 'attrs': {}},
      {'text': 'styled bold and italic text', 'attrs': {'bold': true, 'italic': true}},
      {'text': '.\n', 'attrs': {}},
      {'text': '\n', 'attrs': {}},
      {'text': 'Text with an ', 'attrs': {}},
      {'text': 'underlined mix of ', 'attrs': {'underline': true}},
      {'text': 'bold', 'attrs': {'bold': true, 'underline': true}},
      {'text': ' and ', 'attrs': {'underline': true}},
      {'text': 'italic', 'attrs': {'italic': true, 'underline': true}},
      {'text': ' and ', 'attrs': {'underline': true}},
      {'text': 'strikethrough', 'attrs': {'underline': true, 'strikethrough': true}},
      {'text': '.\n', 'attrs': {'underline': true}},
      {'text': '\n', 'attrs': {}},
      {'text': 'Text with ', 'attrs': {}},
      {'text': 'styled superscript', 'attrs': {'superscript': true}},
      {'text': ', some ', 'attrs': {}},
      {'text': 'tagged superscript', 'attrs': {'superscript': true}},
      {'text': ', some ', 'attrs': {}},
      {'text': 'styled subscript', 'attrs': {'subscript': true}},
      {'text': ', and some ', 'attrs': {}},
      {'text': 'tagged subscript', 'attrs': {'subscript': true}},
      {'text': ' text.\n', 'attrs': {}},
      {'text': '\n', 'attrs': {}},
      {'text': 'Text with ', 'attrs': {}},
      {'text': 'superscript mixed with ', 'attrs': {'superscript': true}},
      {'text': 'bold', 'attrs': {'bold': true, 'superscript': true}},
      {'text': ' and ', 'attrs': {'superscript': true}},
      {'text': 'italic', 'attrs': {'italic': true, 'superscript': true}},
      {'text': ' and ', 'attrs': {'superscript': true}},
      {'text': 'underline', 'attrs': {'superscript': true, 'underline': true}},
      {'text': '.', 'attrs': {}},
      {'text': '\n', 'attrs': {}}
    ])
  })
})

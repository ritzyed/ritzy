import {ATTR} from './attributes'
import {getPixelStyleProperty, normalizeFontWeight, emptyNode} from './dom'
import _ from 'lodash'

// U+0020 SPACE, U+0009 CHARACTER TABULATION (tab), U+000A LINE FEED (LF), U+000C FORM FEED (FF), and U+000D CARRIAGE RETURN (CR)
// (https://html.spec.whatwg.org/multipage/infrastructure.html#space-character)
const SPACE_CHARS = ' \t\n\f\r'
const SPACE_CHARS_EXCEPT_LF = ' \t\f\r'

function insertIntoContainer(node, container) {
  let children = document.createDocumentFragment()
  while (node.childNodes.length > 0) {
    children.appendChild(node.childNodes[0])
  }
  container.appendChild(children)
}

function verticalAlignForElement(node, initialStyle) {
  let verticalAlign
  // why isn't there a simple way to do this??
  while(node && node.nodeType === Node.ELEMENT_NODE) {
    // tagged superscript/subscript computed style values are correct in Chrome/Firefox but not IE, use the tag first
    if(node.nodeName === 'SUP') {
      verticalAlign = 'super'
    } else if(node.nodeName === 'SUB') {
      verticalAlign = 'sub'
    } else {
      let style = initialStyle ? initialStyle : getComputedStyle(node, null)
      let nodeAlign = style.getPropertyValue('vertical-align')
      if(nodeAlign && nodeAlign.length > 0 && nodeAlign !== 'baseline') {
        verticalAlign = nodeAlign
      }
    }
    initialStyle = null
    node = node.parentNode
  }
  return verticalAlign
}

function textDecorationsForElement(node, initialStyle) {
  let decorations
  // this is going to be removed by webkit/blink but could be useful for now
  // https://code.google.com/p/chromium/issues/detail?id=269140
  if(initialStyle.webkitTextDecorationsInEffect) {
    return initialStyle.webkitTextDecorationsInEffect
  }
  // this is simplistic but should generally work ok (does not take into account out of flow and inline level elements)
  // why isn't there a simple way to do this??
  while(node && node.nodeType === Node.ELEMENT_NODE) {
    let style = initialStyle ? initialStyle : getComputedStyle(node, null)
    initialStyle = null
    let nodeDecorations = style.getPropertyValue('text-decoration')
    if(nodeDecorations && nodeDecorations.length > 0 && nodeDecorations !== 'none') {
      if(decorations && decorations.length > 0 && decorations !== 'none') {
        let d = decorations.split(' ')
        d.push(nodeDecorations.split(' '))
        decorations = _.uniq(d).join(' ')
      } else {
        decorations = nodeDecorations
      }
    }
    node = node.parentNode
  }
  return decorations
}

function attributesForElement(node, style) {
  if(_.isUndefined(style)) style = getComputedStyle(node, null)
  let attrs = {}
  let fontWeight = normalizeFontWeight(style.getPropertyValue('font-weight'))
  if (fontWeight === 'bold') {
    attrs[ATTR.BOLD] = true
  }
  if (style.getPropertyValue('font-style') === 'italic') {
    attrs[ATTR.ITALIC] = true
  }
  // vertical align does not inherit, so we need to check ancestors
  let verticalAlign = verticalAlignForElement(node, style)
  if (verticalAlign && verticalAlign === 'super') {
    attrs[ATTR.SUPERSCRIPT] = true
  } else if (verticalAlign === 'sub') {
    attrs[ATTR.SUBSCRIPT] = true
  }
  // text decoration does not inherit, so we need to check ancestors (http://stackoverflow.com/a/1823388/430128)
  let textDecorations = textDecorationsForElement(node, style)
  if (textDecorations && textDecorations.indexOf('underline') > -1) {
    attrs[ATTR.UNDERLINE] = true
  }
  if (textDecorations && textDecorations.indexOf('line-through') > -1) {
    attrs[ATTR.STRIKETHROUGH] = true
  }
  return attrs
}

/**
 * https://rawgit.com/timdown/rangy/master/fiddlings/spec/innerText.htm#ignored-node
 * @param node
 * @returns {boolean}
 */
function ignoredNode(node) {
  return node.nodeType === Node.COMMENT_NODE
      || node.nodeType === Node.PROCESSING_INSTRUCTION_NODE
      || (node.nodeType === Node.ELEMENT_NODE && getComputedStyle(node, null).getPropertyValue('display') === 'none')
}

/**
 * https://rawgit.com/timdown/rangy/master/fiddlings/spec/innerText.htm#leading-whitespace
 * @param el
 */
function elementLeadingWhitespace(el) {
  let style = getComputedStyle(el, null)
  let display = style.getPropertyValue('display')

  let firstNotIgnoredChild = () => {
    for(let i = 0; i < el.children.length; i++) {
      let n = el.children[i]
      if(!ignoredNode(n)) return n
    }
    return null
  }

  if(display === 'inline') {
    let first = firstNotIgnoredChild()
    if(first && first.nodeType === Node.ELEMENT_NODE) {
      return elementLeadingWhitespace(first)
    } else {
      return ''
    }
  } else if(display === 'inline-block'
    || display === 'inline-table'
    || display === 'none'
    || display === 'table-cell'
    || display === 'table-column'
    || display === 'table-column-group') {
    return ''
  } else {
    return '\n'
  }
}

/**
 * https://rawgit.com/timdown/rangy/master/fiddlings/spec/innerText.htm#trailing-whitespace
 * @param el
 */
function elementTrailingWhitespace(el) {
  let style = getComputedStyle(el, null)
  let display = style.getPropertyValue('display')

  let lastNotIgnoredChild = () => {
    for(let i = el.children.length - 1; i >= 0; i--) {
      let n = el.children[i]
      if(!ignoredNode(n)) return n
    }
    return null
  }

  if(display === 'inline') {
    let last = lastNotIgnoredChild()
    if(last && last.nodeType === Node.ELEMENT_NODE) {
      let lastChunks = []
      innerRichText(last, lastChunks)
      return elementTrailingWhitespace(last, lastChunks)
    } else {
      return ''
    }
  } else if(display === 'inline-block'
    || display === 'inline-table'
    || display === 'none'
    || display === 'table-column'
    || display === 'table-column-group') {
    return ''
  } else if(display === 'table-cell') {
    return '\t'
  } else {
    let elChunks = []
    innerRichText(el, elChunks)
    if(elChunks && elChunks.length > 0) {
      let marginBottom = getPixelStyleProperty(style, 'margin-bottom')
      let fontSize = getPixelStyleProperty(style, 'font-size')
      if(marginBottom >= fontSize / 2) return '\n\n'
      else return '\n'
    } else return ''
  }
}

function elementHasNonIgnoredSiblingElement(el) {
  let sibling = el.nextSibling
  while (sibling) {
    if (ignoredNode(sibling) || sibling.nodeName === 'BR') {
      sibling = sibling.nextSibling
    } else if (sibling.nodeType === Node.ELEMENT_NODE) {
      return true
    } else {
      sibling = sibling.nextSibling
    }
  }
  return false
}

/**
 * The text element portion of Aryeh Gregor's aborted innerText proposal. See
 * https://rawgit.com/timdown/rangy/master/fiddlings/spec/innerText.htm.
 *
 * Does not apply any CSS text-transform instructions, but does warn about them to the console.
 *
 * @param node The text node.
 * @param nodeStyle The style of the node containing the text node.
 * @param chunks The array of rich text chunks to append the text node data to.
 * @param nodeAttributes The rich text attributes of the containing node.
 * @param trailingSpace Whether the previous text node had a trailing space.
 */
function innerRichTextForTextNode(node, nodeStyle, chunks, nodeAttributes, trailingSpace) {
  if(_.isUndefined(trailingSpace)) trailingSpace = false

  let inSet = (c, setString) => setString.indexOf(c) > -1

  let advanceUntilNotInSet = (data, position, setString) => {
    let consume = true
    while(consume && position < data.length) {
      if(!inSet(data.charAt(position), setString)) {
        consume = false
      } else {
        position++
      }
    }
    return position
  }

  let lastChunk = chunks.length > 0 ? chunks[chunks.length - 1] : null
  // child is text, step #2
  let data = node.data
  // child is text, step #3
  let whitespace = nodeStyle.getPropertyValue('white-space')
  let whitespaceCollapse = whitespace === 'normal' || whitespace === 'nowrap' || whitespace === 'pre-line'
  if(whitespaceCollapse) {
    // child is text, step #4 - 1
    let whitespaceChars = whitespace === 'normal' || whitespace === 'nowrap' ? SPACE_CHARS : SPACE_CHARS_EXCEPT_LF
    // child is text, step #4 - 2
    let position = 0
    // child is text, step #4 - 3
    let newData = ''
    // child is text, step #4 - 4
    while(position < data.length) {
      let c = data.charAt(position)
      if(whitespaceChars.indexOf(c) > -1) {
        // child is text, step #4 - 4 - 1
        newData += ' '
        position++
        position = advanceUntilNotInSet(data, position, whitespaceChars)
      } else if(c === '\n') {
        // child is text, step #4 - 4 - 2
        if(newData.length > 0 && newData.charAt(newData.length - 1) === ' ') {
          newData = newData.slice(0, newData.length - 1)
        }
        newData += '\n'
        position++
        position = advanceUntilNotInSet(data, position, whitespaceChars)
      } else {
        // child is text, step #4 - 4 - 3
        newData += c
        position++
      }
    }
    // child is text, step #4 - 5
    data = newData
  }
  // child is text, step #5
  if(trailingSpace && (data.length === 0 || !inSet(data.charAt(0), SPACE_CHARS)) && lastChunk) {
    lastChunk.text += ' '
  }
  // child is text, step #6
  if((!lastChunk || lastChunk.text.length === 0 || inSet(lastChunk.text.charAt(lastChunk.text.length - 1), SPACE_CHARS))
    && (data.length > 0 && data.charAt(0) === ' ')
    && whitespaceCollapse) {
    data = data.slice(1)
  }
  // child is text, step #7
  if(whitespaceCollapse && (data.length > 0 && data.charAt(data.length - 1) === ' ')) {
    data = data.slice(0, data.length - 1)
    trailingSpace = true
  } else {
    trailingSpace = false
  }

  // child is text, step #8
  // ignore text-transform
  let textTransform = nodeStyle.getPropertyValue('text-transform')
  if(textTransform !== 'none' && textTransform !== 'normal') {
    console.warn(`Unsupported text-transform ${textTransform} during HTML parsing, ignoring.`)
  }

  // child is text, step #9
  if(data.length > 0) {
    chunks.push({
      text: data,
      attrs: nodeAttributes
    })
  }
  return trailingSpace
}

/**
 * Writes the innerRichText chunks of a node. Logic from Aryeh Gregor's aborted innerText proposal.
 * See https://rawgit.com/timdown/rangy/master/fiddlings/spec/innerText.htm#append-the-plaintext.
 *
 * @param {Node} node The context node for which to obtain the rich text.
 * @param {Array} chunks The array to which parsed rich text chunks (with attributes) should be pushed.
 * @param {boolean} [trailingSpace] Whether the previous node had a trailing space.
 */
function innerRichText(node, chunks, trailingSpace) {
  let nodeAttributes = attributesForElement(node)
  for(let i = 0; i < node.childNodes.length; i++) {
    let child = node.childNodes[i]
    let ignored = ignoredNode(child)
    if (!ignored && child.nodeType === Node.TEXT_NODE) {
      // child is text, step #1
      let nodeStyle = getComputedStyle(node, null)
      if(nodeStyle.getPropertyValue('visibility') !== 'hidden') {
        trailingSpace = innerRichTextForTextNode(child, nodeStyle, chunks, nodeAttributes, trailingSpace)
      }
    } else if (!ignored && child.nodeType === Node.ELEMENT_NODE) {
      // child is element, step #1
      let lastChunk = chunks.length > 0 ? chunks[chunks.length - 1] : null
      if(lastChunk && lastChunk.text.length > 0 && lastChunk.text.charAt(lastChunk.text.length - 1) !== '\n') {
        let leadingWhitespace = elementLeadingWhitespace(child)
        if(leadingWhitespace && leadingWhitespace.length > 0) {
          lastChunk.text += leadingWhitespace
          trailingSpace = false
        }
      }

      // child is element, step #2
      trailingSpace = innerRichText(child, chunks, trailingSpace)

      // child is element, step #3 (with addition to special-case br tag)
      if(child.nodeName === 'BR') {
        chunks.push({
          text: '\n',
          attrs: nodeAttributes
        })
        trailingSpace = false
      } else if (elementHasNonIgnoredSiblingElement(child)) {  // we ignore BR's here too, special cased above
        // a sibling node that is not an ignored node, so we need our trailing whitespace
        lastChunk = chunks.length > 0 ? chunks[chunks.length - 1] : null
        let trailingWhitespace = elementTrailingWhitespace(child)
        if (trailingWhitespace && trailingWhitespace.length > 0) {
          if(!lastChunk) {
            lastChunk = {
              text: '',
              attrs: nodeAttributes
            }
            chunks.push(lastChunk)
          }
          lastChunk.text += trailingWhitespace
          trailingSpace = false
        }
      }
    }
  }
  return trailingSpace
}

/**
 * Parses HTML into chunks of rich text.
 *
 * Argh, getting the appropriate text from an HTML DOM tree is not simple. See
 * http://perfectionkills.com/the-poor-misunderstood-innerText/.
 *
 * Implement Aryeh Gregor's aborted innerText proposal: https://www.w3.org/Bugs/Public/show_bug.cgi?id=13145
 * and https://rawgit.com/timdown/rangy/master/fiddlings/spec/innerText.htm, which works quite well (see the
 * test cases for this module).
 *
 * The innerText algorithm presented by Gregor was slightly modified to return chunks of styled rich text
 * (text with attributes) based on the DOM nodes and their computed styles.
 *
 * @param {string} html The html String to parse.
 * @param {Node} tempContainer An invisible container within the document that can hold the parsed HTML temporarily
 *   so that the browser can compute the CSS styles. This is a hack but there doesn't seem to be a better way of doing
 *   this.
 */
export default function parseHtml(html, tempContainer) {
  let parser = new DOMParser()
  let doc = parser.parseFromString(html, 'text/html')

  let chunks = []

  // IE does not give us an empty body, only a null one, shortcut the subsequent logic in this case
  if(!doc.body) {
    return chunks
  }

  insertIntoContainer(doc.body, tempContainer)

  try {
    innerRichText(tempContainer, chunks)
  } finally {
    emptyNode(tempContainer)
  }

  return chunks
}

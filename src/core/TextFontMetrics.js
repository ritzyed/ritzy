import _ from 'lodash'
import {ATTR, hasAttributeFor} from './attributes'

const SUPER_SUB_FONT_RATIO = 0.65  // matches MS word according to http://en.wikipedia.org/wiki/Subscript_and_superscript

function calcFontScale(fontSize, unitsPerEm) {
  return 1 / unitsPerEm * fontSize
}

function calcSuperSubFontSize(fontSize, minFontSize) {
  let superSubFontSize = Math.round(fontSize * SUPER_SUB_FONT_RATIO)
  return superSubFontSize > minFontSize ? superSubFontSize : minFontSize
}

function charFontStyle(char) {
  let attrs = char.attributes
  if(!attrs) return 'regular'

  let bold = false
  let italic = false

  if(!_.isUndefined(attrs[ATTR.BOLD])) bold = attrs[ATTR.BOLD]
  if(!_.isUndefined(attrs[ATTR.ITALIC])) italic = attrs[ATTR.ITALIC]

  if(bold && italic) return 'boldItalic'
  else if(bold) return 'bold'
  else if(italic) return 'italic'
  else return 'regular'
}

function calcFontSizeFromAttributes(fontSize, minFontSize, attributes) {
  let hasAttribute = hasAttributeFor(attributes)

  // superscript and subscript affect the font size
  let superscript = hasAttribute(ATTR.SUPERSCRIPT)
  let subscript = hasAttribute(ATTR.SUBSCRIPT)

  return superscript || subscript ? calcSuperSubFontSize(fontSize, minFontSize) : fontSize
}

function fontSpec(fontSize, font) {
  let styleSpec = font.styleName === 'Regular' ? '' : `${font.styleName} `
  let fontSizeSpec = `${fontSize}px `
  let name = font.familyName
  return styleSpec + fontSizeSpec + name
}

function calcCharAdvanceOpenType(char, fontSize, font, unitsPerEm) {
  let glyph = font.charToGlyph(char)
  return glyph.unicode ?
    glyph.advanceWidth * calcFontScale(fontSize, unitsPerEm) :
    0
}

let canvas = _.memoize(function() {
  return document.createElement('canvas')
})

let canvasContext = _.memoize(function() {
  return canvas().getContext('2d')
})

function clearCanvas() {
  let c = canvas()
  canvasContext().clearRect(0, 0, c.width, c.height)
}

function calcTextAdvanceCanvas(text, fontSize, font) {
  // need to override newline handling, measureText doesn't handle it correctly (returns a non-zero width)
  if(text === '\n') {
    return 0
  }
  let context = canvasContext()
  context.font = fontSpec(fontSize, font)
  return context.measureText(text).width
}

/**
 * Tests various string widths and compares the advance width (in pixels) results between OpenType.js and
 * the canvas fallback mechanism which returns the browser's actual rendered font width.
 * @type {Function}
 */
let isOpenTypeJsReliable = _.memoize(function(fontSize, font, unitsPerEm) {
  let strings = [
    '111111111111111111111111111111',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'iiiiiiiiiiiiiiiiiiiiiiiiiiiiii',
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
    'Lorem ipsum dolor sit amet, libris essent labitur duo cu.'
  ]

  let reduceOt = function(currentAdvance, char) {
    return currentAdvance + calcCharAdvanceOpenType(char, fontSize, font, unitsPerEm)
  }

  let reduceCanvas = function(currentAdvance, char) {
    return currentAdvance + calcTextAdvanceCanvas(char, fontSize, font)
  }

  let reliable = true
  for(let candidate of strings) {
    let chars = candidate.split('')
    let advanceOt = chars.reduce(reduceOt, 0)
    let advanceCanvas = calcTextAdvanceCanvas(candidate, fontSize, font)
    let delta = Math.abs(advanceOt - advanceCanvas)

    if(delta > 1) {
      console.warn(`OpenType.js NOT reliable on this browser/OS (or font not loaded):
  Candidate = [${candidate}], Fontspec = ${fontSpec(fontSize, font)}, Δ = ${delta}px
  Falling back to slower canvas measurement mechanism.`)

      // test if canvas char-by-char width additions are the same as canvas total text width
      // if this ever returns false, then the current approach will need to be refactored, see docs on calcCharAdvance
      let advanceCanvasByChar = chars.reduce(reduceCanvas, 0)
      let deltaCanvas = Math.abs(advanceCanvas - advanceCanvasByChar)

      if(deltaCanvas > 1) {
        console.error(`Canvas char-by-char width != canvas text width, oops!
  Candidate = [${candidate}], Fontspec = ${fontSpec(fontSize, font)}, Δ ot = ${delta}px, Δ canvas = ${deltaCanvas}px
  Please report this along with your browser/OS details.`)
      }

      reliable = false
      break
    }
  }

  // clear the canvas, not really necessary as measureText shouldn't write anything there
  clearCanvas()
  return reliable
}, (fontSize, font, unitsPerEm) => fontSpec(fontSize, font) + ' ' + unitsPerEm)

/**
 * Calculate the advance in pixels for a given char. In some browsers/platforms/font sizes, the fonts are not
 * rendered according to the specs in the font (see
 * http://stackoverflow.com/questions/30922573/firefox-rendering-of-opentype-font-does-not-match-the-font-specification).
 * Therefore, ensure the font spec matches the actual rendered width (via the canvas `measureText` method), and use
 * the font spec if it matches, otherwise fall back to the (slower) measuredText option.
 *
 * NOTE there may still be one difference between the browser's rendering and canvas-based calculations here: the
 * browser renders entire strings within elements, whereas this calculation renders one character to the canvas at
 * a time and adds up the widths. These two approaches seem to be equivalent except for IE in compatibility mode.
 *
 * TODO refactor mixin to deal with chunks of styled text rather than chars for IE in compatibility mode
 */
function calcCharAdvance(char, fontSize, font, unitsPerEm) {
  return isOpenTypeJsReliable(fontSize, font, unitsPerEm) ?
    calcCharAdvanceOpenType(char, fontSize, font, unitsPerEm) :
    calcTextAdvanceCanvas(char, fontSize, font)
}

function calcReplicaCharAdvance(replicaChar, fontSize, fonts, minFontSize, unitsPerEm) {
  let style = charFontStyle(replicaChar)
  let charFontSize = calcFontSizeFromAttributes(fontSize, minFontSize, replicaChar.attributes)
  return calcCharAdvance(replicaChar.char, charFontSize, fonts[style], unitsPerEm)
}

export default {
  setConfig(config) {
    this.config = config
  },

  /**
   * Get the font scale to convert between font units and pixels for the given font size.
   * @param fontSize
   * @return {number}
   */
  fontScale(fontSize) {
    return calcFontScale(fontSize, this.config.unitsPerEm)
  },

  /**
   * Return the font size given the default font size and current attributes.
   * @param fontSize
   * @param attributes
   */
  fontSizeFromAttributes(fontSize, attributes) {
    return calcFontSizeFromAttributes(fontSize, this.config.minFontSize, attributes)
  },

  /**
   * Determines the advance for a given replica char.
   * @param char The replica char object.
   * @param fontSize
   * @return {number}
   */
  replicaCharAdvance(char, fontSize) {
    return calcReplicaCharAdvance(char, fontSize, this.config.fonts, this.config.minFontSize, this.config.unitsPerEm)
  },

  /**
   * Determines the advance for a given char. Since it is not a replica char, the font style and other attribute
   * information cannot be determined. A normal weight, non-decorated font with no special attributes is assumed.
   */
  charAdvance(char, fontSize, font) {
    return calcCharAdvance(char, fontSize, font, this.config.unitsPerEm)
  },

  /**
   * Returns the advance width in pixels for a space character in the normal style.
   */
  advanceXForSpace(fontSize) {
    return this.charAdvance(' ', fontSize, this.config.fonts.regular)
  },

  /**
   * Obtain an Object with the char id and cursor position for a given pixel value. This is used to
   * set the current character and position the cursor correctly on a mouse click. If the target position
   * is past the last character, the index of the last character is returned.
   * @param {number} fontSize
   * @param {number} pixelValue
   * @param {Array} chars The characters used to compare against the given pixel value.
   * @return {Object} The cursor x position (cursorX) between characters, and the 0-based character index
   *   (index) for the given x value.
   */
  indexAndCursorForXValue(fontSize, pixelValue, chars) {
    let minFontSize = this.config.minFontSize
    fontSize = fontSize > minFontSize ? fontSize : minFontSize
    let currentWidthPx = 0
    let index = 0
    for(let i = 0; i < chars.length; i++) {
      let glyphAdvancePx = this.replicaCharAdvance(chars[i], fontSize)
      if(pixelValue < currentWidthPx + glyphAdvancePx / 2) {
        return {
          cursorX: currentWidthPx,
          index: index
        }
      } else {
        currentWidthPx += glyphAdvancePx
        if(glyphAdvancePx > 0) index++
      }
    }
    return {
      cursorX: currentWidthPx,
      index: index
    }
  },

  /**
   * Get the advance width in pixels for the given char or chars.
   * @param {number} fontSize
   * @param {object|Array} chars
   * @return {number}
   */
  advanceXForChars(fontSize, chars) {
    let minFontSize = this.config.minFontSize
    fontSize = fontSize > minFontSize ? fontSize : minFontSize
    if(_.isArray(chars)) {
      return chars.reduce((currentWidthPx, char) => {
        return currentWidthPx + this.replicaCharAdvance(char, fontSize)
      }, 0)
    } else {
      return this.replicaCharAdvance(chars, fontSize)
    }
  },

  /**
   * Gets the line height in pixels for a given font size, using the bold font.
   */
  lineHeight(fontSize) {
    let fontHeader = this.config.fonts.bold.tables.head
    return (fontHeader.yMax - fontHeader.yMin) * this.fontScale(fontSize)
  },

  /**
   * Gets the height in pixels of the top of the font, relative to the baseline, using the bold font.
   */
  top(fontSize) {
    let fontHeader = this.config.fonts.bold.tables.head
    return fontHeader.yMax * this.fontScale(fontSize)
  }
}

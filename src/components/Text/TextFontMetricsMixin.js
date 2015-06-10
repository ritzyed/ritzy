import _ from 'lodash'
import {ATTR, hasAttributeFor} from './attributes'

let SUPER_SUB_FONT_RATIO = 0.65  // matches MS word according to http://en.wikipedia.org/wiki/Subscript_and_superscript

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

function charScale(char, fontSize, unitsPerEm, minFontSize) {
  let attrs = char.attributes
  if(!attrs) return calcFontScale(fontSize, unitsPerEm)

  let superscript = false
  let subscript = false
  if(!_.isUndefined(attrs[ATTR.SUPERSCRIPT])) superscript = attrs[ATTR.SUPERSCRIPT]
  if(!_.isUndefined(attrs[ATTR.SUBSCRIPT])) subscript = attrs[ATTR.SUBSCRIPT]

  if(superscript || subscript) {
    return calcFontScale(calcSuperSubFontSize(fontSize, minFontSize), unitsPerEm)
  } else {
    return calcFontScale(fontSize, unitsPerEm)
  }
}

export default {
  /**
   * Get the font scale to convert between font units and pixels for the given font size.
   * @param fontSize
   * @return {number}
   */
  fontScale(fontSize) {
    return calcFontScale(fontSize, this.props.unitsPerEm)
  },

  /**
   * Determines the superscript and subscript font size given a regular font size. The size will be the
   * regular font size times the defined ratio value, rounded to the nearest pixel, and then brought
   * up the minimum font size allowed by the browser.
   * @param fontSize
   * @return {number}
   */
  superSubFontSize(fontSize) {
    return calcSuperSubFontSize(fontSize, this.props.minFontSize)
  },

  /**
   * Returns the advance width in pixels for a space character in the normal style.
   */
  advanceXForSpace(fontSize) {
    let glyph = this.props.fonts.regular.charToGlyph(' ')
    return glyph.advanceWidth * this.fontScale(fontSize)
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
    let minFontSize = this.props.minFontSize
    let unitsPerEm = this.props.unitsPerEm
    fontSize = fontSize > minFontSize ? fontSize : minFontSize
    let currentWidthPx = 0
    let index = 0
    for(let i = 0; i < chars.length; i++) {
      let style = charFontStyle(chars[i])
      let glyph = this.props.fonts[style].charToGlyph(chars[i].char)
      let glyphAdvancePx = 0
      if(glyph.unicode) {
        glyphAdvancePx = glyph.advanceWidth * charScale(chars[i], fontSize, unitsPerEm, minFontSize)
      }
      if(pixelValue < currentWidthPx + glyphAdvancePx / 2) {
        return {
          cursorX: currentWidthPx,
          index: index
        }
      } else {
        currentWidthPx += glyphAdvancePx
        if(glyph.unicode) index++
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
    let minFontSize = this.props.minFontSize
    let unitsPerEm = this.props.unitsPerEm
    fontSize = fontSize > minFontSize ? fontSize : minFontSize
    if(_.isArray(chars)) {
      let currentWidthPx = 0
      for(let i = 0; i < chars.length; i++) {
        let style = charFontStyle(chars[i])
        let glyph = this.props.fonts[style].charToGlyph(chars[i].char)
        if(glyph.unicode) {
          // no kerning for now, to support kerning use this.props.fonts[style].getKerningValue(leftGlyph, rightGlyph)
          currentWidthPx += glyph.advanceWidth * charScale(chars[i], fontSize, unitsPerEm, minFontSize)
        }
      }
      return currentWidthPx
    } else {
      let style = charFontStyle(chars)
      let glyph = this.props.fonts[style].charToGlyph(chars.char)
      return glyph.unicode ? glyph.advanceWidth * charScale(chars, fontSize, unitsPerEm, minFontSize) : 0
    }
  },

  /**
   * Gets the line height in pixels for a given font size, using the bold font.
   */
  lineHeight(fontSize) {
    var fontHeader = this.props.fonts.bold.tables.head
    return (fontHeader.yMax - fontHeader.yMin) * this.fontScale(fontSize)
  },

  /**
   * Gets the height in pixels of the top of the font, relative to the baseline, using the bold font.
   */
  top(fontSize) {
    var fontHeader = this.props.fonts.bold.tables.head
    return fontHeader.yMax * this.fontScale(fontSize)
  },

  /**
   * Return the font size given the default font size and current attributes.
   * @param fontSize
   * @param attributes
   */
  fontSizeFromAttributes(fontSize, attributes) {
    let hasAttribute = hasAttributeFor(attributes)

    // superscript and subscript affect the font size
    let superscript = hasAttribute(ATTR.SUPERSCRIPT)
    let subscript = hasAttribute(ATTR.SUBSCRIPT)

    return superscript || subscript ? this.superSubFontSize(fontSize) : fontSize
  }
}

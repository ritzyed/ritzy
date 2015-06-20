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

function calcFontSizeFromAttributes(fontSize, minFontSize, attributes) {
  let hasAttribute = hasAttributeFor(attributes)

  // superscript and subscript affect the font size
  let superscript = hasAttribute(ATTR.SUPERSCRIPT)
  let subscript = hasAttribute(ATTR.SUBSCRIPT)

  return superscript || subscript ? calcSuperSubFontSize(fontSize, minFontSize) : fontSize
}

function calcCharAdvance(char, fontSize, font, unitsPerEm) {
  let glyph = font.charToGlyph(char)
  return glyph.unicode ?
    glyph.advanceWidth * calcFontScale(fontSize, unitsPerEm) :
    0
}

function calcReplicaCharAdvance(replicaChar, fontSize, fonts, minFontSize, unitsPerEm) {
  let style = charFontStyle(replicaChar)
  let charFontSize = calcFontSizeFromAttributes(fontSize, minFontSize, replicaChar.attributes)
  return calcCharAdvance(replicaChar.char, charFontSize, fonts[style], unitsPerEm)
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
   * Return the font size given the default font size and current attributes.
   * @param fontSize
   * @param attributes
   */
  fontSizeFromAttributes(fontSize, attributes) {
    return calcFontSizeFromAttributes(fontSize, this.props.minFontSize, attributes)
  },

  /**
   * Determines the advance for a given replica char.
   * @param char The replica char object.
   * @param fontSize
   * @return {number}
   */
  replicaCharAdvance(char, fontSize) {
    return calcReplicaCharAdvance(char, fontSize, this.props.fonts, this.props.minFontSize, this.props.unitsPerEm)
  },

  /**
   * Determines the advance for a given char. Since it is not a replica char, the font style and other attribute
   * information cannot be determined. A normal weight, non-decorated font with no special attributes is assumed.
   */
  charAdvance(char, fontSize, font) {
    return calcCharAdvance(char, fontSize, font, this.props.unitsPerEm)
  },

  /**
   * Returns the advance width in pixels for a space character in the normal style.
   */
  advanceXForSpace(fontSize) {
    return this.charAdvance(' ', fontSize, this.props.fonts.regular)
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
    let minFontSize = this.props.minFontSize
    fontSize = fontSize > minFontSize ? fontSize : minFontSize
    if(_.isArray(chars)) {
      let currentWidthPx = 0
      for(let i = 0; i < chars.length; i++) {
        currentWidthPx += this.replicaCharAdvance(chars[i], fontSize)
      }
      return currentWidthPx
    } else {
      return this.replicaCharAdvance(chars, fontSize)
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
  }
}

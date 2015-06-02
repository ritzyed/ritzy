import _ from 'lodash'
import invariant from 'react/lib/invariant'
import Spec from 'swarm/lib/Spec'
import Syncable from 'swarm/lib/Syncable'

const BASE_CHAR = {id: '00000+swarm', char: ''}

/**
 * Contains the textual data and corresponding lamport timestamps (ids) for each character. Each character
 * has a primary id, but may have secondary ids representing deleted characters at that position. In addition,
 * each character has a list of other "rich" attributes, such as bold, color, and so forth.
 *
 * Currently the data storage is in regular JS arrays, but perhaps we could use immutable-js:
 *  - (possible) faster or more consistent insertion performance, splice performance is implementation dependent
 *  - blazing fast reference equality comparisons
 */
class TextData {
  constructor() {
    this.weave = ['']
    this.ids = [BASE_CHAR.id]
    this.deletedIds = [[]]  // an array of arrays
    this.attributes = [{}]  // an array of objects
  }

  len() {
    return this.weave.length
  }

  getChar(pos) {
    invariant(pos < this.len(), 'Index ' + pos + ' out of bounds.' + JSON.stringify(this.weave))
    let obj = {
      char: this.weave[pos],
      id: this.ids[pos]
    }
    if (this.deletedIds[pos] && this.deletedIds[pos].length > 0) {
      obj.deletedIds = _.clone(this.deletedIds[pos])
    }
    if (this.attributes[pos] && !_.isEmpty(this.attributes[pos])) {
      obj.attributes = _.clone(this.attributes[pos])
    }
    return obj
  }

  insertChar(pos, char, id, attributes) {
    invariant(pos !== 0, 'Cannot insert at position 0.')
    invariant(pos <= this.len(), 'Index ' + pos + ' out of bounds.')
    this.weave.splice(pos, 0, char)
    this.ids.splice(pos, 0, id)
    this.deletedIds.splice(pos, 0, null)
    let attrs = null
    if(attributes) {
      attrs = attributes
    }
    this.attributes.splice(pos, 0, attrs)
    this.currentId = id
  }

  deleteChar(pos) {
    invariant(pos !== 0, 'Cannot delete position 0.')
    invariant(pos < this.len(), 'Index ' + pos + ' out of bounds.')
    this.weave.splice(pos, 1)
    if(!this.deletedIds[pos - 1]) {
      this.deletedIds[pos - 1] = []
    }
    this.deletedIds[pos - 1].push(this.ids[pos])
    if(this.deletedIds[pos]) {
      //for (let id of this.deletedIds[pos]) {
      for(let i = 0; i < this.deletedIds[pos].length; i++) {
        this.deletedIds[pos - 1].push(this.deletedIds[pos][i])
      }
    }
    this.currentId = this.ids[pos]
    this.deletedIds.splice(pos, 1)
    this.ids.splice(pos, 1)
    this.attributes.splice(pos, 1)
  }

  setCharAttr(pos, attributes) {
    invariant(pos !== 0, 'Cannot set attributes of position 0.')
    invariant(pos < this.len(), 'Index ' + pos + ' out of bounds.')

    this.attributes[pos] = attributes
  }

  matches(pos, ids, includeDeleted) {
    invariant(pos < this.len(), 'Index out of bounds.')
    includeDeleted = includeDeleted !== false
    if(!_.isArray(ids)) ids = [ids]
    let matches = 0
    if(_.includes(ids, this.ids[pos])) {
      matches += 1
    }
    if(includeDeleted && this.deletedIds[pos]) {
      matches += _.intersection(this.deletedIds[pos], ids).length
    }
    return matches
  }

  text() {
    return this.weave.join('')
  }
}

/**
 * This is based on the Text.js demo class from the SwarmJS library by @gritzko, with the following primary
 * differences:
 *
 * 1) The `weave` was stored as a string. It is now an array within TextData.
 *
 * 2) The `weave` contained characters and then backspace characters for deletions. Deletions are now stored in
 * per-character buckets so that they don't have to be constantly filtered out of the weave. This is also quite
 * amenable to tombstone clearing.
 *
 * 3) Added the ability to store rich-text and other attributes in per-character buckets.
 *
 * 4) Created an API to get/set changes via "deltas". The delta format is from https://github.com/ottypes/rich-text.
 * This provides some limited support to applications that wish to convert CRDT ops to/from operational transform
 * ops. This support may be removed in the future.
 *
 * Note that for non-basic multilingual plane (BMP) characters (rare!) using string.length could be wrong in
 * Javascript. See https://mathiasbynens.be/notes/javascript-encoding.
 */
let Text = Syncable.extend('Text', {
  // naive uncompressed CT weave implementation based on Swarm Text.js
  defaults: {
    text: '',
    data: {type: TextData},
    _oplog: Object
  },

  ops: {
    insert(spec, ins, src) {  // eslint-disable-line no-unused-vars
      let vt = spec.token('!'), v = vt.bare
      let ts = v.substr(0, 5), seq = v.substr(5) || '00'
      let seqi = Spec.base2int(seq)
      let genTs
      let insertKeys = ins ? Object.keys(ins) : []
      for (let i = 0; i < this.data.len(); i++) {
        for(let j = 0; j < insertKeys.length; j++) {
          let insKey = insertKeys[j]
          if (this.data.matches(i, insKey) > 0) {
            let str = ins[insKey].value
            let attrs = ins[insKey].attributes
            let k = i + 1
            while (k < this.data.len() && this.data.getChar(k).id > vt.body) {
              k++
            }
            if (k > i + 1) { // concurrent edits
              let newid = this.data.getChar(k - 1).id
              ins[newid] = ins[insKey]
              delete ins[insKey]
            } else {
              for (let l = 0; l < str.length; l++) {
                genTs = ts + (seqi ? Spec.int2base(seqi++, 2) : '') + '+' + vt.ext
                this.data.insertChar(i + l + 1, str.charAt(l), genTs, attrs)
                if (!seqi) {
                  seqi = 1 // FIXME repeat ids, double insert
                }
              }
              i += str.length
            }
          }
        }
      }
      if (genTs) {
        this._host.clock.checkTimestamp(genTs)
      }
      this.rebuild()
    },

    remove(spec, rm, src) {  // eslint-disable-line no-unused-vars
      //let v = spec.version()
      if(!rm) return
      let rmKeys = Object.keys(rm)
      for (let i = 1; i < this.data.len(); i++) {
        if (this.data.matches(i, rmKeys) > 0) {
          this.data.deleteChar(i)
          i -= 1
        }
      }
      this.rebuild()
    },

    /**
     * Set attributes for the given chars. Attributes are overwritten, therefore it is client code's
     * responsibility to "merge" existing attributes with new ones.
     */
    setAttributes(spec, attrs, src) {  // eslint-disable-line no-unused-vars
      if(!attrs) return
      let attrKeys = Object.keys(attrs)
      for (let i = 1; i < this.data.len(); i++) {
        for(let j = 0; j < attrKeys.length; j++) {
          if (this.data.matches(i, attrKeys[j], false) > 0) {
            this.data.setCharAttr(i, attrs[attrKeys[j]])
          }
        }
      }
      this.rebuild()
    }
  },

  rebuild() {
    this.text = this.data.text()
  },

  /**
   * A delta is based on the operational transform rich text type. See https://github.com/ottypes/rich-text.
   * @param delta
   */
  applyDelta(delta) {
    let rm = null
    let ins = null
    let pos = 1  // skip \n #00000+swarm

    for(let i = 0; i < delta.length; i++) {
      let op = delta[i]
      if(op.insert) {
        invariant(pos > 0, 'Cannot insert at position 0.')
        if(!ins) ins = {}
        ins[this.data.getChar(pos - 1).id] = {
          value: op.insert,
          attributes: op.attributes
        }
        // we don't increment pos here because the insert hasn't actually happened yet
      }
      if(op.delete) {
        invariant(pos > 0, 'Cannot delete position 0.')
        if(!rm) rm = {}
        let rmcount = op.delete
        for (let j = 0; j < rmcount; j++) {
          rm[this.data.getChar(pos).id] = true
          pos += 1
        }
      }
      if(op.retain) {
        pos += op.retain
      }
    }

    if(rm) this.remove(rm)
    if(ins) this.insert(ins)
  },

  /**
   * Obtain a delta based on an insert operation. Note that this must be run *after* the insert has already
   * occurred on the replica. This can be used to obtain deltas for updating a local editor based on an op received
   * from the replica event system.
   * @param op
   * @returns {Array}
   */
  deltaFromInsert(op) {
    let delta = []
    let foundCount = 0
    let opKeys = op ? Object.keys(op) : []
    let lastInsert = 0
    for (let i = 0; i < this.data.len(); i++) {
      for(let j = 0; j < opKeys.length; j++) {
        let opKey = opKeys[j]
        if (this.data.matches(i, opKey) > 0) {
          if (i - lastInsert > 0) delta.push({retain: i - lastInsert})
          let str = op[opKey].value
          let deltaOp = {insert: str}
          let attrs = op[opKey].attributes
          if(attrs) {
            deltaOp.attributes = attrs
          }
          delta.push(deltaOp)
          lastInsert = i + str.length
          foundCount += 1
          if (foundCount >= opKeys.length) {
            return delta
          }
        }
      }
    }
    return delta
  },

  /**
   * Obtain a delta based on a remove operation. Note that this must be run *after* the remove has already
   * occurred on the replica. This can be used to obtain deltas for updating a local editor based on an op received
   * from the replica event system.
   * @param op
   * @returns {Array}
   */
  deltaFromRemove(op) {
    let delta = []
    let foundCount = 0
    let opKeys = Object.keys(op)
    let lastRemove = 0
    for (let i = 0; i < this.data.len(); i++) {
      var matchCount = this.data.matches(i, opKeys)
      if (matchCount > 0) {
        if(i - lastRemove > 0) delta.push({ retain: i - lastRemove })
        // since the delete has already occurred we need to use the number of matched ids at the current char
        delta.push({ delete: matchCount })
        lastRemove = i
        foundCount += matchCount
        if(foundCount >= opKeys.length) {
          return delta
        }
      }
    }
    return delta
  },

  /**
   * Insert chars with optional attributes at a given position.
   * @param {object} char The position at which to insert.
   * @param {string} value The string value to insert.
   * @param {object} [attributes] Attributes to set, or no attributes if not set.
   */
  insertCharsAt(char, value, attributes) {
    let ins = {}
    ins[char.id] = {
      value: value,
      attributes: attributes
    }
    this.insert(ins)
  },

  /**
   * Delete the given chars.
   * @param {char[]} chars
   */
  rmChars(chars) {
    if(!chars) return
    let rm = {}
    if(_.isArray(chars)) {
      for(let i = 0; i < chars.length; i++) {
        rm[chars[i].id] = true
      }
    } else {
      rm[chars.id] = true
    }
    this.remove(rm)
  },

  /**
   * Sets new text. All current text contents are deleted (though the deleted ids remain).
   * @param {string} newText
   * @param {object} [attributes]
   */
  set(newText, attributes) {
    this.rmChars(this.getTextRange(BASE_CHAR))
    this.insertCharsAt(BASE_CHAR, newText, attributes)
  },

  /**
   * Gets the char for the given char or id. Can be used to "refresh" the char information which is
   * a snapshot with the latest replica information.
   * @param {char|number} charOrId
   * @returns {*}
   */
  getChar(charOrId) {
    return this.getCharRelativeTo(charOrId, 0, 'error')
  },

  /**
   * Gets the char at the given position. Position 0 is always the BASE_CHAR. An Error is thrown
   * if the position is out of bounds.
   * @param {number} pos
   * @returns {*}
   */
  getCharAt(pos) {
    return this.data.getChar(pos)
  },

  /**
   * Returns the index of a given char or ID. Index 0 is always the BASE_CHAR. If the char is not
   * found, returns -1.
   * @param {char|number} charOrId
   * @param {boolean} [includeDeleted=true] Whether to include deletec chars in the match.
   * @returns number
   */
  indexOf(charOrId, includeDeleted) {
    invariant(charOrId, 'From char must be defined.')
    let id = _.has(charOrId, 'id') ? charOrId.id : charOrId
    for (let i = 0; i < this.data.len(); i++) {
      if (this.data.matches(i, id, includeDeleted) > 0) return i
    }
    return -1
  },

  /**
   * Gets a character relative to another character. Relative can be positive or
   * negative. If the position becomes out of bound, the position can wrap, limit to
   * the end, or error (depending on the last parameter).
   * @param {char|number} charOrId
   * @param {number} relative
   * @param {string} [wrap='wrap'] The behavior when the index is out of bounds. Must be one
   *   of 'wrap', 'limit', or 'error'.
   * @return {*}
   */
  getCharRelativeTo(charOrId, relative, wrap) {
    invariant(charOrId, 'Char must be defined.')
    if(_.isUndefined(relative)) relative = 0
    if(_.isUndefined(wrap)) wrap = 'wrap'
    let id = _.has(charOrId, 'id') ? charOrId.id : charOrId
    for (let i = 0; i < this.data.len(); i++) {
      if (this.data.matches(i, id) > 0) {
        let index = i + relative
        if(wrap === 'wrap') {
          if(index < 0) index = this.data.len() + index
          else if(index >= this.data.len()) index = index - this.data.len()
        } else if (wrap === 'limit') {
          if(index < 0) index = 0
          else if(index >= this.data.len()) index = this.data.len() - 1
        } else if (wrap === 'error') {
          if(index < 0 || index >= this.data.len()) {
            throw new Error('Index out of bounds: ' + index)
          }
        } else {
          throw new Error('Undefined wrap value: ' + wrap)
        }
        return this.getCharAt(index)
      }
    }
  },

  /**
   * Gets all the chars from a given ID (exclusive) to a given ID (inclusive). The length of the returned
   * range is going to be `pos(toChar) - pos(fromChar)`.
   * @param fromCharOrId
   * @param toCharOrId If the to char does not exist, then to char is the last char.
   * @returns {Array}
   */
  getTextRange(fromCharOrId, toCharOrId) {
    invariant(fromCharOrId, 'From char must be defined.')
    let fromMatched = false
    let chars = []
    let fromId = _.has(fromCharOrId, 'id') ? fromCharOrId.id : fromCharOrId
    let toId
    if(!_.isUndefined(toCharOrId)) {
      toId = _.has(toCharOrId, 'id') ? toCharOrId.id : toCharOrId
    }

    if(fromId === toId) {
      return chars
    }
    for (let i = 0; i < this.data.len(); i++) {
      if (!fromMatched && this.data.matches(i, fromId) > 0) {
        // the fromId is exclusive
        fromMatched = true
        if(fromId === toId) {
          chars.push(this.getCharAt(i))
          return chars
        }
      } else if(toId && this.data.matches(i, toId) > 0) {
        invariant(fromMatched, 'From id must precede To id.')
        chars.push(this.getCharAt(i))
        return chars
      } else if(fromMatched) {
        chars.push(this.getCharAt(i))
      }
    }
    return chars
  },

  /**
   * Compares the position of two chars. Follows the contract of Java Comparator
   * (http://docs.oracle.com/javase/8/docs/api/java/util/Comparator.html#compare-T-T-) and returns
   * a negative integer, zero, or a positive integer as the first argument is positioned before,
   * equal to, or positioned after the second.
   * @param charOrId1
   * @param charOrId2
   * @return {number}
   */
  compareCharPos(charOrId1, charOrId2) {
    invariant(charOrId1, 'First char must be defined.')
    invariant(charOrId2, 'Second char must be defined.')
    let char1Id = _.has(charOrId1, 'id') ? charOrId1.id : charOrId1
    let char2Id = _.has(charOrId2, 'id') ? charOrId2.id : charOrId2
    let seen1Index
    let seen2Index
    for (let i = 0; i < this.data.len(); i++) {
      if (this.data.matches(i, char1Id) > 0) {
        seen1Index = i
      }
      if(char1Id === char2Id || this.data.matches(i, char2Id) > 0) {
        seen2Index = i
      }
      if(!_.isUndefined(seen1Index) && !_.isUndefined(seen2Index)) {
        if(seen1Index < seen2Index) return -1
        else if(seen1Index === seen2Index) return 0
        else return 1
      }
    }
    throw new Error('One or both chars were not found.')
  }
})

export default Text
export { BASE_CHAR, TextData }

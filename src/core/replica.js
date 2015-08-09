/**
 * Parses a Swarm spec and returns its data as an object.
 * @param spec
 * @returns {{source: *, op: *}}
 */
export function parseSpec(spec) {
  // spec seems to have some internal parsing state "index" which prevents accessing it consistently
  // https://github.com/gritzko/swarm/issues/53
  let oldIndex = spec.index
  spec.index = 0
  let source
  try {
    source = spec.source()
  } catch (e) {
    source = null
  }
  let op
  try {
    op = spec.op()
  } catch (e) {
    op = null
  }
  spec.index = oldIndex
  return {
    source: source,
    op: op
  }
}

/**
 * Returns the source from within a Swarm spec.
 * @param spec
 * @returns {*}
 */
export function sourceOf(spec) {
  return parseSpec(spec).source
}

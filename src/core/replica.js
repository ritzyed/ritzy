/**
 * Returns the source from within a replica spec.
 * @param spec
 * @returns {*}
 */
export function sourceOf(spec) {
  // spec seems to have some internal parsing state "index" which prevents accessing it consistently
  // https://github.com/gritzko/swarm/issues/53
  let oldIndex = spec.index
  spec.index = 0
  let source
  try {
    source = spec.source()
  } catch (e) {
    return null
  }
  spec.index = oldIndex
  return source
}

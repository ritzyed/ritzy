/**
 * Writes chunks of rich text into a plain text. The implementation is simple: just strip any style
 * information from the rich text.
 *
 * @param {Array} chunks The rich text chunks to write.
 */
export default function writeText(chunks) {
  let text = ''

  if(!chunks) {
    chunks = []
  }

  chunks.forEach(c => {
    text += c.text
  })

  return text
}

export function verifyResolvedModel({ model, maps, emitters }) {
  if (!model || typeof model !== 'object') {
    throw new Error('compile: resolved model must be an object')
  }
  if (!maps || typeof maps !== 'object') {
    throw new Error('compile: generated platform maps must be an object')
  }
  if (!Array.isArray(emitters)) {
    throw new Error('compile: emitters must be an array')
  }
  for (const emitter of emitters) {
    if (!emitter || typeof emitter.emit !== 'function') {
      throw new Error('compile: every emitter must provide emit(maps)')
    }
  }
}

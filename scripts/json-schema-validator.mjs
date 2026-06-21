// Minimal, dependency-free JSON Schema validator (draft-07 subset).
//
// Supported keywords: type, const, enum, required, properties,
// additionalProperties (boolean | schema), items, minItems, pattern.
// Anything else (title, description, $schema, $id, ...) is ignored.
//
// Intentionally tiny — the repo carries zero runtime dependencies for its
// scripts, so we validate against the small, hand-written schemas under
// schemas/ instead of pulling in a full validator. Returns an array of
// human-readable error strings (empty array === valid).

function typeOf(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function matchesType(value, type) {
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value)
  if (type === 'number') return typeof value === 'number'
  if (type === 'object') return typeOf(value) === 'object'
  if (type === 'array') return Array.isArray(value)
  if (type === 'null') return value === null
  return typeOf(value) === type
}

function deepEqual(a, b) {
  if (a === b) return true
  if (typeOf(a) !== typeOf(b)) return false
  if (Array.isArray(a)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]))
  }
  if (typeOf(a) === 'object') {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    return aKeys.length === bKeys.length && aKeys.every((key) => deepEqual(a[key], b[key]))
  }
  return false
}

function label(path) {
  return path || '(root)'
}

function walk(value, schema, path, errors) {
  if (!schema || typeof schema !== 'object') return

  if ('const' in schema && !deepEqual(value, schema.const)) {
    errors.push(`${label(path)}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`)
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => deepEqual(candidate, value))) {
    errors.push(`${label(path)}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`)
  }

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    if (!types.some((type) => matchesType(value, type))) {
      errors.push(`${label(path)}: expected type ${types.join('|')}, got ${typeOf(value)}`)
      return
    }
  }

  if (typeOf(value) === 'object') {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in value)) errors.push(`${label(path)}: missing required property "${key}"`)
      }
    }
    const properties = schema.properties || {}
    const additional = schema.additionalProperties
    for (const key of Object.keys(value)) {
      const childPath = `${path}/${key}`
      if (key in properties) {
        walk(value[key], properties[key], childPath, errors)
      } else if (additional === false) {
        errors.push(`${childPath}: unexpected property "${key}" (additionalProperties: false)`)
      } else if (additional && typeof additional === 'object') {
        walk(value[key], additional, childPath, errors)
      }
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push(`${label(path)}: expected at least ${schema.minItems} item(s), got ${value.length}`)
    }
    if (schema.items) {
      value.forEach((item, index) => walk(item, schema.items, `${path}/${index}`, errors))
    }
  }

  if (typeof value === 'string' && typeof schema.pattern === 'string') {
    if (!new RegExp(schema.pattern).test(value)) {
      errors.push(`${label(path)}: "${value}" does not match pattern /${schema.pattern}/`)
    }
  }
}

export function validate(value, schema, instancePath = '') {
  const errors = []
  walk(value, schema, instancePath, errors)
  return errors
}

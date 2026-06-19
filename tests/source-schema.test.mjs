import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validate } from '../scripts/json-schema-validator.mjs'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

function load(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'))
}

const productSchema = load('schemas/product.schema.json')

function freshProduct() {
  return load('products/hearthcode/product.json')
}

test('the shipped product source matches its schema', () => {
  assert.deepEqual(validate(freshProduct(), productSchema), [])
})

test('a missing required property is reported', () => {
  const product = freshProduct()
  delete product.publisher
  const errors = validate(product, productSchema)
  assert.ok(errors.some((error) => error.includes('publisher')), errors.join('\n'))
})

test('a typo\'d (additional) property is reported', () => {
  const product = freshProduct()
  product.publischer = product.publisher
  const errors = validate(product, productSchema)
  assert.ok(errors.some((error) => error.includes('publischer')), errors.join('\n'))
})

test('a wrong-typed property is reported', () => {
  const product = freshProduct()
  product.supportedSchemeIds = 'moss'
  const errors = validate(product, productSchema)
  assert.ok(errors.some((error) => error.includes('supportedSchemeIds')), errors.join('\n'))
})

test('a bad const (schemaVersion) is reported', () => {
  const product = freshProduct()
  product.schemaVersion = 2
  const errors = validate(product, productSchema)
  assert.ok(errors.some((error) => error.includes('const')), errors.join('\n'))
})

test('an out-of-enum value is reported', () => {
  const product = freshProduct()
  product.featuredThemes[0].variantId = 'twilight'
  const errors = validate(product, productSchema)
  assert.ok(errors.some((error) => error.includes('variantId')), errors.join('\n'))
})

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parsePagination } from '../../src/utils/pagination.js'

describe('parsePagination', () => {
  test('defaults to page 1, 20 per page', () => {
    assert.deepEqual(parsePagination({}), { page: 1, perPage: 20, skip: 0, limit: 20 })
  })

  test('computes skip from page', () => {
    assert.deepEqual(parsePagination({ page: '3', per_page: '10' }), {
      page: 3, perPage: 10, skip: 20, limit: 10,
    })
  })

  test('clamps page to at least 1', () => {
    assert.equal(parsePagination({ page: '0' }).page, 1)
    assert.equal(parsePagination({ page: '-5' }).page, 1)
  })

  test('clamps per_page into 1..100', () => {
    assert.equal(parsePagination({ per_page: '0' }).perPage, 20)
    assert.equal(parsePagination({ per_page: '101' }).perPage, 100)
  })

  test('falls back on non-numeric input', () => {
    assert.deepEqual(parsePagination({ page: 'abc', per_page: 'xyz' }), {
      page: 1, perPage: 20, skip: 0, limit: 20,
    })
  })
})

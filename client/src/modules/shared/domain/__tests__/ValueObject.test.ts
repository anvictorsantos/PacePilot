import { describe, expect, it } from 'vitest'

import { InvalidArgumentError } from '@/modules/shared/domain/exception/InvalidArgumentError'
import { StringValueObject } from '@/modules/shared/domain/value-object/StringValueObject'

class Name extends StringValueObject {}
class OtherName extends StringValueObject {}

describe('ValueObject', () => {
  it('compares by class and value', () => {
    expect(new Name('ana').equals(new Name('ana'))).toBe(true)
    expect(new Name('ana').equals(new Name('bea'))).toBe(false)
  })

  it('is not equal across subclasses with the same value', () => {
    expect(new Name('ana').equals(new OtherName('ana'))).toBe(false)
  })

  it('refuses an undefined value', () => {
    expect(() => new Name(undefined as unknown as string)).toThrow(InvalidArgumentError)
  })

  it('stringifies its primitive', () => {
    expect(new Name('ana').toString()).toBe('ana')
  })
})

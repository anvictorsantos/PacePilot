import { InvalidArgumentError } from '@/modules/shared/domain/exception/InvalidArgumentError'

type Primitives = string | number | boolean | Date

// Base value object: immutable, compared by value, defined by a primitive.
export abstract class ValueObject<T extends Primitives> {
  readonly value: T

  constructor(value: T) {
    this.ensureValueIsDefined(value)
    this.value = value
  }

  equals(other: ValueObject<T>): boolean {
    return other.constructor.name === this.constructor.name && other.value === this.value
  }

  toString(): string {
    return String(this.value)
  }

  private ensureValueIsDefined(value: T): void {
    if (value === null || value === undefined) {
      throw new InvalidArgumentError('Value must be defined')
    }
  }
}

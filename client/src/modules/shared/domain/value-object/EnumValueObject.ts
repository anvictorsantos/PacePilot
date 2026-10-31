import { InvalidArgumentError } from '@/modules/shared/domain/exception/InvalidArgumentError'
import { ValueObject } from '@/modules/shared/domain/value-object/ValueObject'

// Base for the enums this codebase repeats as string literals. Membership is enforced on
// construction, so an unknown wire value fails here instead of rendering blank downstream.
export abstract class EnumValueObject<T extends string> extends ValueObject<T> {
  constructor(
    value: T,
    readonly validValues: readonly T[],
  ) {
    super(value)
    this.ensureValueIsValid(value)
  }

  static values<T extends string>(this: { validValues: readonly T[] }): readonly T[] {
    return this.validValues
  }

  private ensureValueIsValid(value: T): void {
    if (!this.validValues.includes(value)) {
      throw new InvalidArgumentError(
        `<${this.constructor.name}> does not allow the value <${value}>`,
      )
    }
  }
}

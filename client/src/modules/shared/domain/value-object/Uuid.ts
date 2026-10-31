import { InvalidArgumentError } from '@/modules/shared/domain/exception/InvalidArgumentError'
import { ValueObject } from '@/modules/shared/domain/value-object/ValueObject'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// The reference uses the `uuid` packages; this app takes no new dependency, so it
// uses `crypto.randomUUID()` and validates with a pattern.
export class Uuid extends ValueObject<string> {
  constructor(value: string) {
    super(value)
    this.ensureIsValidUuid(value)
  }

  static random(): Uuid {
    return new Uuid(crypto.randomUUID())
  }

  private ensureIsValidUuid(id: string): void {
    if (!UUID_PATTERN.test(id)) {
      throw new InvalidArgumentError(`<${this.constructor.name}> does not allow the value <${id}>`)
    }
  }
}

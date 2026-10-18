import { ValueObject } from './ValueObject'
import { InvalidArgumentError } from '../exception/InvalidArgumentError'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Identifier value object. The reference uses the `uuid` + `uuid-validate`
 * packages; this app takes no new dependency, so it uses the platform
 * `crypto.randomUUID()` (browsers and Node 19+) and validates with a pattern.
 */
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

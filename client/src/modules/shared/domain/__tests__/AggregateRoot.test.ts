import { describe, expect, it } from 'vitest'

import { AggregateRoot } from '@/modules/shared/domain/AggregateRoot'
import { DomainEvent } from '@/modules/shared/domain/DomainEvent'

class SomethingHappenedDomainEvent extends DomainEvent {
  static readonly EVENT_NAME = 'something.happened'

  constructor(params: { aggregateId: string; detail: string }) {
    super({ eventName: SomethingHappenedDomainEvent.EVENT_NAME, aggregateId: params.aggregateId })
    this.detail = params.detail
  }

  readonly detail: string

  toPrimitives(): Record<string, unknown> {
    return { detail: this.detail }
  }
}

class Thing extends AggregateRoot {
  private constructor(readonly id: string) {
    super()
  }

  static create(id: string): Thing {
    const thing = new Thing(id)
    thing.record(new SomethingHappenedDomainEvent({ aggregateId: id, detail: 'created' }))
    return thing
  }

  rename(): void {
    this.record(new SomethingHappenedDomainEvent({ aggregateId: this.id, detail: 'renamed' }))
  }

  toPrimitives(): Record<string, unknown> {
    return { id: this.id }
  }
}

describe('AggregateRoot', () => {
  it('accumulates what happened, in order', () => {
    const thing = Thing.create('thing-1')
    thing.rename()

    const events = thing.pullDomainEvents()

    expect(events.map((event) => (event as SomethingHappenedDomainEvent).detail)).toEqual([
      'created',
      'renamed',
    ])
  })

  it('hands the events over once — pulling clears them', () => {
    const thing = Thing.create('thing-1')
    expect(thing.pullDomainEvents()).toHaveLength(1)
    expect(thing.pullDomainEvents()).toHaveLength(0)
  })

  it('names every event and carries its aggregate', () => {
    const [event] = Thing.create('thing-1').pullDomainEvents()
    expect(event?.eventName).toBe('something.happened')
    expect(event?.aggregateId).toBe('thing-1')
    expect(event?.eventId).toBeTruthy()
    expect(event?.occurredOn).toBeInstanceOf(Date)
  })
})

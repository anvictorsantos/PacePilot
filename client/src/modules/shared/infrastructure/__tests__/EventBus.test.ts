import { describe, expect, it, vi } from 'vitest'

import { DomainEvent } from '@/modules/shared/domain/DomainEvent'
import type { DomainEventSubscriber } from '@/modules/shared/domain/DomainEventSubscriber'
import { Container } from '@/modules/shared/infrastructure/container'
import { DomainEventSubscribers } from '@/modules/shared/infrastructure/EventBus/DomainEventSubscribers'
import { InMemoryAsyncEventBus } from '@/modules/shared/infrastructure/EventBus/InMemory/InMemoryAsyncEventBus'

class RanDomainEvent extends DomainEvent {
  static readonly EVENT_NAME = 'ran'
  constructor(aggregateId: string) {
    super({ eventName: RanDomainEvent.EVENT_NAME, aggregateId })
  }
  toPrimitives(): Record<string, unknown> {
    return {}
  }
}

class WalkedDomainEvent extends DomainEvent {
  static readonly EVENT_NAME = 'walked'
  constructor(aggregateId: string) {
    super({ eventName: WalkedDomainEvent.EVENT_NAME, aggregateId })
  }
  toPrimitives(): Record<string, unknown> {
    return {}
  }
}

function subscriber(
  events: Array<typeof RanDomainEvent | typeof WalkedDomainEvent>,
  on: (event: DomainEvent) => Promise<void>,
): DomainEventSubscriber<DomainEvent> {
  return {
    subscribedTo: () => events,
    on: on as (event: DomainEvent) => Promise<void>,
  }
}

function busWith(...subscribers: Array<DomainEventSubscriber<DomainEvent>>) {
  const container = new Container()
  subscribers.forEach((one) => container.bind('DomainEventSubscriber', () => one))
  const bus = new InMemoryAsyncEventBus()
  bus.addSubscribers(DomainEventSubscribers.from(container))
  return bus
}

describe('InMemoryAsyncEventBus', () => {
  it('delivers an event to everyone subscribed to it, and to nobody else', async () => {
    const ranHandler = vi.fn()
    const walkedHandler = vi.fn()
    const bus = busWith(
      subscriber([RanDomainEvent], ranHandler),
      subscriber([WalkedDomainEvent], walkedHandler),
    )

    await bus.publish([new RanDomainEvent('a')])

    expect(ranHandler).toHaveBeenCalledTimes(1)
    expect(walkedHandler).not.toHaveBeenCalled()
  })

  it('publishes several events in one go', async () => {
    const handler = vi.fn()
    const bus = busWith(subscriber([RanDomainEvent], handler))

    await bus.publish([new RanDomainEvent('a'), new RanDomainEvent('b')])

    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('settles even when a subscriber throws, so a failed side effect cannot undo the change', async () => {
    const after = vi.fn()
    const bus = busWith(
      subscriber([RanDomainEvent], () => Promise.reject(new Error('toast blew up'))),
      subscriber([RanDomainEvent], after),
    )

    await expect(bus.publish([new RanDomainEvent('a')])).resolves.toBeUndefined()
    expect(after).toHaveBeenCalledTimes(1)
  })
})

describe('Container', () => {
  it('resolves a binding', () => {
    const container = new Container()
    container.bind('greeting', () => 'hello')
    expect(container.get<string>('greeting')).toBe('hello')
  })

  it('resolves every binding of a token, in registration order', () => {
    const container = new Container()
    container.bind('subscriber', () => 'first')
    container.bind('subscriber', () => 'second')
    expect(container.getAll<string>('subscriber')).toEqual(['first', 'second'])
  })

  it('lets a factory depend on the container', () => {
    const container = new Container()
    container.bind('name', () => 'ana')
    container.bind('greeting', (c) => `hello ${c.get<string>('name')}`)
    expect(container.get<string>('greeting')).toBe('hello ana')
  })

  it('throws for an unbound token', () => {
    expect(() => new Container().get('missing')).toThrow(/No binding/)
  })

  it('collects the subscribers a container knows, for the bus', () => {
    const container = new Container()
    const one = subscriber([RanDomainEvent], vi.fn())
    container.bind('DomainEventSubscriber', () => one)

    expect(DomainEventSubscribers.from(container).items).toEqual([one])
  })
})

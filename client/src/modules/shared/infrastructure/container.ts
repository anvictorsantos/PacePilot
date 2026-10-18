/**
 * Minimal container. The reference wires modules with Inversify; this app takes
 * no new dependency, so the same two operations are hand-rolled: bind a token to
 * a factory, resolve it (or every binding of it, which is how the event bus
 * collects its subscribers).
 */
export type ContainerToken = string | symbol | (abstract new (...args: never[]) => unknown)

export type Factory<T> = (container: Container) => T

export class Container {
  private readonly bindings = new Map<ContainerToken, Array<Factory<unknown>>>()
  private readonly singletons = new Map<ContainerToken, unknown>()

  bind<T>(token: ContainerToken, factory: Factory<T>): void {
    const factories = this.bindings.get(token) ?? []
    factories.push(factory as Factory<unknown>)
    this.bindings.set(token, factories)
  }

  /** One instance per token, created on first resolve. */
  bindSingleton<T>(token: ContainerToken, factory: Factory<T>): void {
    this.bind(token, (container) => {
      if (!this.singletons.has(token)) this.singletons.set(token, factory(container))
      return this.singletons.get(token) as T
    })
  }

  /** Last binding wins — the token resolves to a single instance. */
  get<T>(token: ContainerToken): T {
    const factories = this.bindings.get(token)
    if (!factories?.length) throw new Error(`No binding for <${String(token)}>`)
    return factories[factories.length - 1]?.(this) as T
  }

  /** Every binding of a token, in registration order. */
  getAll<T>(token: ContainerToken): T[] {
    const factories = this.bindings.get(token) ?? []
    return factories.map((factory) => factory(this) as T)
  }

  has(token: ContainerToken): boolean {
    return Boolean(this.bindings.get(token)?.length)
  }
}

/** The application container: shared infrastructure plus every module's wiring. */
export const container = new Container()

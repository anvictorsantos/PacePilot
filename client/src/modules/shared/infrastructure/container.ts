// Hand-rolled container, no Inversify dependency: a token maps to many factories,
// and `getAll` is how the event bus collects its subscribers.
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

  bindSingleton<T>(token: ContainerToken, factory: Factory<T>): void {
    this.bind(token, (container) => {
      if (!this.singletons.has(token)) this.singletons.set(token, factory(container))
      return this.singletons.get(token) as T
    })
  }

  /** Last binding wins. */
  get<T>(token: ContainerToken): T {
    const factories = this.bindings.get(token)
    if (!factories?.length) throw new Error(`No binding for <${String(token)}>`)
    return factories[factories.length - 1]?.(this) as T
  }

  getAll<T>(token: ContainerToken): T[] {
    const factories = this.bindings.get(token) ?? []
    return factories.map((factory) => factory(this) as T)
  }

  has(token: ContainerToken): boolean {
    return Boolean(this.bindings.get(token)?.length)
  }
}

export const container = new Container()

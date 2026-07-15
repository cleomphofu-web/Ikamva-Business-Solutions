export class ServiceContainer {
  constructor(parent = null) {
    this.parent = parent;
    this.registrations = new Map();
    this.instances = new Map();
  }

  register(name, factory) {
    if (!name || typeof factory !== 'function') {
      throw new Error('ServiceContainer.register requires a name and factory function.');
    }

    this.registrations.set(name, factory);
    return this;
  }

  registerValue(name, value) {
    return this.register(name, () => value);
  }

  resolve(name) {
    if (this.instances.has(name)) {
      return this.instances.get(name);
    }

    if (this.registrations.has(name)) {
      const instance = this.registrations.get(name)(this);
      this.instances.set(name, instance);
      return instance;
    }

    if (this.parent) {
      return this.parent.resolve(name);
    }

    throw new Error(`Service "${name}" is not registered.`);
  }

  createScope() {
    return new ServiceContainer(this);
  }
}

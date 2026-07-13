export class ProviderRegistry {
  constructor(providers = {}) {
    this.providers = new Map(Object.entries(providers));
  }

  register(name, provider) {
    if (!name || !provider) {
      throw new Error('ProviderRegistry.register requires a name and provider.');
    }

    this.providers.set(name, provider);
    return this;
  }

  get(name) {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider "${name}" is not registered.`);
    }

    return provider;
  }
}

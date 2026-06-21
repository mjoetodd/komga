import { TTSProvider } from './tts-provider'
import { BrowserTTSProvider } from './browser-tts-provider'
import { ServerTTSProvider } from './server-tts-provider'

export class TTSProviderRegistry {
  private static instance: TTSProviderRegistry | null = null
  private providers: Map<string, TTSProvider> = new Map()
  private activeProviderId = 'browser'

  private constructor() {
    this.registerProvider(new BrowserTTSProvider())
    this.registerProvider(new ServerTTSProvider())
  }

  static getInstance(): TTSProviderRegistry {
    if (!TTSProviderRegistry.instance) {
      TTSProviderRegistry.instance = new TTSProviderRegistry()
    }
    return TTSProviderRegistry.instance
  }

  registerProvider(provider: TTSProvider) {
    this.providers.set(provider.id, provider)
  }

  getProvider(id: string): TTSProvider | undefined {
    return this.providers.get(id)
  }

  getActiveProvider(): TTSProvider {
    const provider = this.providers.get(this.activeProviderId)
    if (!provider) {
      // Fallback to browser
      this.activeProviderId = 'browser'
      return this.providers.get('browser')!
    }
    return provider
  }

  async setActiveProvider(id: string, config: Record<string, any> = {}): Promise<TTSProvider> {
    const provider = this.providers.get(id)
    if (!provider) {
      throw new Error(`TTS Provider ${id} is not registered.`)
    }
    
    await provider.initialize(config)
    this.activeProviderId = id
    return provider
  }

  getRegisteredProviders(): { id: string; name: string }[] {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
    }))
  }
}

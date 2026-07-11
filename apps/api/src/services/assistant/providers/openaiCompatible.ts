import type { ActiveAgentConfig } from '../../agentSettings';
import type { OpenAIClientLike } from './openai';
import { OpenAIProviderAdapter } from './openai';

export class OpenAICompatibleProviderAdapter extends OpenAIProviderAdapter {
    constructor(settings: ActiveAgentConfig, client: OpenAIClientLike) {
        super(settings, client);
    }
}

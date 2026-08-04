
const store = { capabilities: null as any, host: 'server' as const }
export const useCapabilitiesStore = () => store
useCapabilitiesStore.getState = () => store

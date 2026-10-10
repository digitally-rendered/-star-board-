import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { FeatureModel } from '@star-board/core';
import type { HttpClient } from '../client/createClient.js';
import { createOperationsPort, type OperationsPort } from '../data/operations.js';
import type { AgentPort, AuthPort, NotifyPort } from '../ports.js';

/** Everything a consuming app wires once (plan Part 3): the client and the ports. */
export interface Services {
  client: HttpClient;
  auth: AuthPort;
  notify: NotifyPort;
  agent?: AgentPort;
  /** The FeatureModel the client was generated from; required unless `operations` is given. */
  model?: FeatureModel;
  /** A stub or custom OperationsPort; defaults to one built from `client` and `model`. */
  operations?: OperationsPort;
}

const ServicesContext = createContext<Services | null>(null);

/** Puts the adapters in context once (typescript/05 §1); hooks never construct one. */
export function ServicesProvider(props: { services: Services; children?: ReactNode }) {
  return (
    <ServicesContext.Provider value={props.services}>{props.children}</ServicesContext.Provider>
  );
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (services === null) {
    throw new Error('useServices: no ServicesProvider above this component');
  }
  return services;
}

/** The OperationsPort the data hooks call: the one given, else built from client and model. */
export function useOperations(): OperationsPort {
  const { operations, client, model } = useServices();
  return useMemo(() => {
    if (operations) return operations;
    if (!model) {
      throw new Error('useOperations: Services needs either `operations` or `model`');
    }
    return createOperationsPort(client, model);
  }, [operations, client, model]);
}

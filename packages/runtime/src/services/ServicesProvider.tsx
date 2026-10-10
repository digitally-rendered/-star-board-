import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { FeatureModel } from '@star-board/core';
import type { Client } from 'openapi-fetch';
import type { UntypedPaths } from '../client/createClient.js';
import { createOperationsPort, type OperationsPort } from '../data/operations.js';
import type { AgentPort, AuthPort, NotifyPort } from '../ports.js';

/**
 * Everything a consuming app wires once (plan Part 3): the client and the ports. `Paths` is the
 * generated `paths` type of the typed client; the runtime itself only calls the client by path
 * string, so inside the runtime services are read as `Services` (untyped paths).
 */
export interface Services<Paths extends object = UntypedPaths> {
  client: Client<Paths>;
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
export function ServicesProvider<Paths extends object = UntypedPaths>(props: {
  services: Services<Paths>;
  children?: ReactNode;
}) {
  // The runtime addresses the client by path string only; a typed client is a narrower view of
  // the same object, so erasing `Paths` here is sound and lets generated clients plug in.
  const services = props.services as unknown as Services;
  return <ServicesContext.Provider value={services}>{props.children}</ServicesContext.Provider>;
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

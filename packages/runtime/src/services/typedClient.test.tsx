import { describe, expect, it } from 'vitest';
import createOpenApiClient from 'openapi-fetch';
import { ServicesProvider, type Services } from './ServicesProvider.js';
import type { AuthPort, NotifyPort } from '../ports.js';

/** A generated-style `paths` type: no string index signature, one concrete route. */
interface Paths {
  '/pet': {
    get: {
      responses: { 200: { content: { 'application/json': { items: unknown[]; total: number } } } };
    };
  };
}

const auth: AuthPort = {
  getToken: () => Promise.resolve(null),
  getPrincipal: () => null,
  onUnauthorized: () => undefined,
};
const notify: NotifyPort = { notify: () => undefined };

describe('Services accepts a typed client', () => {
  it('a Client<paths> without an index signature is assignable to Services<paths>', () => {
    const client = createOpenApiClient<Paths>({ baseUrl: 'http://localhost' });
    const services: Services<Paths> = { client, auth, notify };
    const element = <ServicesProvider services={services}>{null}</ServicesProvider>;
    expect(element).toBeTruthy();
    expect(services.client).toBe(client);
  });
});

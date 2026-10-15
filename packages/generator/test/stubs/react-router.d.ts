/** Stub of `react-router` for the compile test: what the generated route table uses. */
// eslint-disable-next-line no-restricted-imports -- a stub of a consumer module; the generator itself never imports React
import type { ReactNode } from 'react';

export interface RouteObject {
  path?: string;
  element?: ReactNode;
  errorElement?: ReactNode;
  children?: RouteObject[];
}
export interface ErrorResponse {
  status: number;
  statusText: string;
  data: unknown;
}
export declare function isRouteErrorResponse(error: unknown): error is ErrorResponse;
export declare function useRouteError(): unknown;
export declare function useNavigate(): (to: string) => void | Promise<void>;
export declare function useParams<K extends string = string>(): Readonly<
  Partial<Record<K, string>>
>;

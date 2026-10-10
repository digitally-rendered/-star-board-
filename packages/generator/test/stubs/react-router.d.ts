/** Stub of `react-router` for the compile test: what the generated route table uses. */
// eslint-disable-next-line no-restricted-imports -- a stub of a consumer module; the generator itself never imports React
import type { ReactNode } from 'react';

export interface RouteObject {
  path?: string;
  element?: ReactNode;
  children?: RouteObject[];
}
export declare function useNavigate(): (to: string) => void | Promise<void>;
export declare function useParams<K extends string = string>(): Readonly<
  Partial<Record<K, string>>
>;

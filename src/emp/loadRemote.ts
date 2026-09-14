import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as JsxRuntime from 'react/jsx-runtime';
import * as ReactRouterDom from 'react-router-dom';
import * as I18next from 'i18next';
import * as ReactI18next from 'react-i18next';
import * as Zustand from 'zustand';
import * as Antd from 'antd';
import {applyEmpRemoteEntry, resolveEmpRemoteEntryUrl} from './remoteUrl';

type RemoteEntry = {
  get: (expose: string) => Promise<(() => unknown) | unknown>;
  init: (shareScope: Record<string, unknown>) => void;
};

type SharedEntry = {
  get: () => Promise<() => unknown>;
  loaded: 1;
  from: string;
};

function importRemoteEntry(url: string): Promise<RemoteEntry> {
  const specifier = `${url}`;
  return import(/* @vite-ignore */ specifier) as Promise<RemoteEntry>;
}

function share(version: string, ns: object): Record<string, SharedEntry> {
  return {
    [version]: {
      get: () => Promise.resolve(() => ns),
      loaded: 1,
      from: 'akanshoAdmin',
    },
  };
}

function pkgVersion(mod: object, fallback: string): string {
  const version = (mod as {version?: string}).version;
  return version || fallback;
}

function hostShareScope(): Record<string, unknown> {
  const reactVersion = pkgVersion(React, '19.2.8');
  return {
    react: share(reactVersion, React),
    'react-dom': share(pkgVersion(ReactDOM, reactVersion), ReactDOM),
    'react/jsx-runtime': share(reactVersion, JsxRuntime),
    'react-router-dom': share(pkgVersion(ReactRouterDom, '7.18.2'), ReactRouterDom),
    i18next: share(pkgVersion(I18next, '26.3.6'), I18next),
    'react-i18next': share(pkgVersion(ReactI18next, '17.0.11'), ReactI18next),
    zustand: share(pkgVersion(Zustand, '5.0.14'), Zustand),
    antd: share(pkgVersion(Antd, '5.29.3'), Antd),
  };
}

function asComponentModule(mod: unknown): {default: React.ComponentType} {
  const resolved = typeof mod === 'function' ? (mod as () => unknown)() : mod;
  const record = (resolved || {}) as {default?: React.ComponentType};
  const Component = record.default || (resolved as React.ComponentType);
  if (typeof Component !== 'function') {
    throw new Error('Employee Management module has no UI export');
  }
  return {default: Component};
}

export async function loadFederatedEmployeeManagement(): Promise<{
  default: React.ComponentType<Record<string, unknown>>;
}> {
  const url = resolveEmpRemoteEntryUrl();
  applyEmpRemoteEntry(url);
  let remote: RemoteEntry;
  try {
    remote = await importRemoteEntry(url);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Unable to load Employee Management from ${url}. ${detail}`,
    );
  }
  if (typeof remote?.get !== 'function') {
    throw new Error(
      `Employee Management remoteEntry.js at ${url} is not a federation module.`,
    );
  }
  if (typeof remote.init === 'function') {
    remote.init(hostShareScope());
  }
  const factory = await remote.get('./EmployeeManagement');
  return asComponentModule(factory) as {
    default: React.ComponentType<Record<string, unknown>>;
  };
}

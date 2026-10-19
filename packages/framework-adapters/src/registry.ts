import { IFrameworkAdapter } from './types.js';
import { ReactAdapter } from './react/adapter.js';
import { NextjsAdapter } from './nextjs/adapter.js';
import { VueAdapter } from './vue/adapter.js';
import { ExpoAdapter } from './expo/adapter.js';
import { AstroAdapter } from './astro/adapter.js';

export function getAdapter(frameworkName: string): IFrameworkAdapter {
  switch (frameworkName.toLowerCase()) {
    case 'nextjs':
    case 'next':
      return new NextjsAdapter();
    case 'react':
      return new ReactAdapter();
    case 'expo':
    case 'react-native':
      return new ExpoAdapter();
    case 'astro':
      return new AstroAdapter();
    case 'vue':
      return new VueAdapter();
    default:
      // Default to React
      return new ReactAdapter();
  }
}

export async function detectAdapter(projectRoot: string): Promise<IFrameworkAdapter> {
  const expoAdapter = new ExpoAdapter();
  if (await expoAdapter.detect(projectRoot)) {
    return expoAdapter;
  }

  const astroAdapter = new AstroAdapter();
  if (await astroAdapter.detect(projectRoot)) {
    return astroAdapter;
  }

  const nextAdapter = new NextjsAdapter();
  if (await nextAdapter.detect(projectRoot)) {
    return nextAdapter;
  }

  const vueAdapter = new VueAdapter();
  if (await vueAdapter.detect(projectRoot)) {
    return vueAdapter;
  }

  const reactAdapter = new ReactAdapter();
  if (await reactAdapter.detect(projectRoot)) {
    return reactAdapter;
  }

  return reactAdapter;
}

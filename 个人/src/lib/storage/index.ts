/**
 * StorageDriver factory
 *
 * 单例懒加载. 业务代码:
 *   import { getStorage } from '@/lib/storage';
 *   await getStorage().put(key, stream);
 */
import { LocalDriver } from './local';
import { OssDriver } from './oss';
import type { StorageDriver } from './types';

let instance: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (instance) return instance;
  const driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();
  switch (driver) {
    case 'local':
      instance = new LocalDriver();
      break;
    case 'oss':
      instance = new OssDriver();
      break;
    default:
      throw new Error(`unknown STORAGE_DRIVER: ${driver}`);
  }
  return instance;
}

export type { StorageDriver } from './types';
export { assertSafeKey } from './types';

export interface R2StorageService {
  listObjects(prefix?: string): Promise<string[]>;
  getObject(key: string): Promise<string | null>;
}

export function createR2StorageService(r2: R2Bucket): R2StorageService {
  const listObjects = async (prefix?: string): Promise<string[]> => {
    const objects = await r2.list({ prefix });
    return objects.objects.map((obj) => obj.key);
  };

  const getObject = async (key: string): Promise<string | null> => {
    const object = await r2.get(key);
    if (!object) return null;

    const text = await object.text();
    return text;
  };

  return { listObjects, getObject };
}

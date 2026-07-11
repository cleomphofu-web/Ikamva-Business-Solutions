const STORAGE_PREFIX = 'ikamva_app';

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const memoryStorage = new Map();

const getStorage = () => {
  if (isBrowser) {
    return window.localStorage;
  }

  return {
    getItem: key => memoryStorage.get(key) ?? null,
    setItem: (key, value) => memoryStorage.set(key, value),
    removeItem: key => memoryStorage.delete(key),
  };
};

const storage = getStorage();

const safeJsonParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const clone = value => {
  if (value == null) return value;
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getCollectionKey = entityName => `${STORAGE_PREFIX}:${entityName}`;

const getCollection = entityName => {
  const raw = storage.getItem(getCollectionKey(entityName));
  const parsed = safeJsonParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
};

const setCollection = (entityName, records) => {
  storage.setItem(getCollectionKey(entityName), JSON.stringify(records));
  notifySubscribers(entityName, records);
};

const notifySubscribers = (entityName, records) => {
  const listeners = recordSubscribers.get(entityName);
  if (!listeners) return;

  for (const listener of listeners) {
    try {
      listener(clone(records));
    } catch (error) {
      console.error(`Record subscriber for ${entityName} failed`, error);
    }
  }
};

const compareValues = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};

const sortRecords = (records, sort) => {
  if (!sort || typeof sort !== 'string') {
    return records;
  }

  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;

  return [...records].sort((left, right) => {
    const result = compareValues(left?.[field], right?.[field]);
    return descending ? -result : result;
  });
};

const filterRecords = (records, criteria = {}) => {
  const entries = Object.entries(criteria || {});
  if (entries.length === 0) {
    return records;
  }

  return records.filter(record => entries.every(([key, expected]) => {
    if (Array.isArray(expected)) {
      return expected.includes(record?.[key]);
    }

    if (expected && typeof expected === 'object') {
      if ('equals' in expected) return record?.[key] === expected.equals;
      if ('in' in expected && Array.isArray(expected.in)) return expected.in.includes(record?.[key]);
    }

    return record?.[key] === expected;
  }));
};

const normalizeListArgs = (sortOrLimit, maybeLimit) => {
  if (typeof sortOrLimit === 'string') {
    return { sort: sortOrLimit, limit: maybeLimit };
  }

  if (typeof sortOrLimit === 'number') {
    return { sort: undefined, limit: sortOrLimit };
  }

  return { sort: undefined, limit: maybeLimit };
};

const normalizeFilterArgs = (criteria, sortOrLimit, maybeLimit) => {
  if (typeof sortOrLimit === 'string') {
    return { sort: sortOrLimit, limit: maybeLimit };
  }

  if (typeof sortOrLimit === 'number') {
    return { sort: undefined, limit: sortOrLimit };
  }

  return { sort: undefined, limit: maybeLimit };
};

const takeLimit = (records, limit) => {
  if (typeof limit !== 'number') return records;
  return records.slice(0, limit);
};

const recordSubscribers = new Map();

const createRecordApi = recordType => ({
  async list(sortOrLimit, maybeLimit) {
    const { sort, limit } = normalizeListArgs(sortOrLimit, maybeLimit);
    const records = sortRecords(getCollection(recordType), sort ?? '-created_date');
    return clone(takeLimit(records, limit));
  },
  async filter(criteria = {}, sortOrLimit, maybeLimit) {
    const { sort, limit } = normalizeFilterArgs(criteria, sortOrLimit, maybeLimit);
    const records = filterRecords(getCollection(recordType), criteria);
    return clone(takeLimit(sortRecords(records, sort ?? '-created_date'), limit));
  },
  async get(id) {
    const record = getCollection(recordType).find(item => item?.id === id) ?? null;
    return clone(record);
  },
  async create(data) {
    const now = new Date().toISOString();
    const record = {
      id: createId(),
      created_date: now,
      updated_date: now,
      ...clone(data),
    };
    const records = [...getCollection(recordType), record];
    setCollection(recordType, records);
    return clone(record);
  },
  async update(id, data) {
    const now = new Date().toISOString();
    const records = getCollection(recordType);
    const index = records.findIndex(item => item?.id === id);
    if (index === -1) return null;

    const updated = {
      ...records[index],
      ...clone(data),
      id: records[index].id,
      created_date: records[index].created_date ?? now,
      updated_date: now,
    };
    records[index] = updated;
    setCollection(recordType, records);
    return clone(updated);
  },
  async delete(id) {
    const records = getCollection(recordType).filter(item => item?.id !== id);
    setCollection(recordType, records);
    return true;
  },
  subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    if (!recordSubscribers.has(recordType)) {
      recordSubscribers.set(recordType, new Set());
    }

    const listeners = recordSubscribers.get(recordType);
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        recordSubscribers.delete(recordType);
      }
    };
  },
});

const records = new Proxy({}, {
  get: (_target, recordType) => createRecordApi(String(recordType)),
});

export const appServices = {
  records,
  files: {
    async upload({ file } = {}) {
      // TODO: Replace with backend file storage when a production API is available.
      if (!file) {
        return { file_url: '' };
      }

      const fileUrl = isBrowser && typeof URL !== 'undefined'
        ? URL.createObjectURL(file)
        : '';

      return {
        file_url: fileUrl,
        file_name: file.name ?? '',
        file_type: file.type ?? '',
      };
    },
  },
  email: {
    async send() {
      // TODO: Replace with backend email delivery when a production API is available.
      return { success: true, queued: true };
    },
  },
  ai: {
    async generateJson() {
      // TODO: Replace with backend AI generation when a production API is available.
      return {
        summary: 'Backend AI generation is not configured yet.',
      };
    },
  },
};

export default appServices;

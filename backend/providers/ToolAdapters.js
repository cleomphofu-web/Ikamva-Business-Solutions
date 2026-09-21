/**
 * EmailProvider.js
 *
 * Narrow provider interface for email integrations (Gmail, Outlook, etc.).
 */
export class EmailProvider {
  /**
   * List unread emails since an optional timestamp.
   * @param {object} [options]
   * @param {string} [options.since]
   * @param {number} [options.maxResults]
   * @param {string} [options.credentialReference]
   * @param {string} [options.tenantId]
   * @returns {Promise<Array<{ id: string, threadId: string, sender: string, subject: string, snippet: string, date: string }>>}
   */
  async listUnread(options = {}) {
    throw new Error('EmailProvider.listUnread must be implemented by adapter');
  }

  /**
   * Retrieve full email thread.
   * @param {string} threadId
   * @param {object} [options]
   * @returns {Promise<{ id: string, messages: Array<any> }>}
   */
  async getThread(threadId, options = {}) {
    throw new Error('EmailProvider.getThread must be implemented by adapter');
  }

  /**
   * Create an email draft.
   * @param {object} draftInput
   * @param {string} draftInput.to
   * @param {string} draftInput.subject
   * @param {string} draftInput.body
   * @param {Array<any>} [draftInput.attachments]
   * @param {string} [draftInput.threadId]
   * @param {object} [options]
   * @returns {Promise<{ draftId: string, threadId: string }>}
   */
  async createDraft(draftInput, options = {}) {
    throw new Error('EmailProvider.createDraft must be implemented by adapter');
  }

  /**
   * Send a draft or direct email.
   * @param {string} draftId
   * @param {object} [options]
   * @returns {Promise<{ messageId: string, threadId: string, sent: boolean }>}
   */
  async send(draftId, options = {}) {
    throw new Error('EmailProvider.send must be implemented by adapter');
  }
}

/**
 * CRMProvider.js
 * Narrow interface for CRM integrations (HubSpot, internal CRM, etc.).
 */
export class CRMProvider {
  async findContact(email, options = {}) {
    throw new Error('CRMProvider.findContact must be implemented by adapter');
  }

  async upsertContact(data, options = {}) {
    throw new Error('CRMProvider.upsertContact must be implemented by adapter');
  }

  async updateDeal(dealId, fields, options = {}) {
    throw new Error('CRMProvider.updateDeal must be implemented by adapter');
  }
}

/**
 * DocumentGenerator.js
 * Narrow interface for quote/invoice document rendering.
 */
export class DocumentGenerator {
  async generate(templateId, data, options = {}) {
    throw new Error('DocumentGenerator.generate must be implemented by adapter');
  }
}

/**
 * FileStorageProvider.js
 * Narrow interface for storing generated attachments and documents.
 */
export class FileStorageProvider {
  async upload(path, content, mimeType, options = {}) {
    throw new Error('FileStorageProvider.upload must be implemented by adapter');
  }

  async download(path, options = {}) {
    throw new Error('FileStorageProvider.download must be implemented by adapter');
  }
}

/**
 * SpreadsheetProvider.js
 * Narrow interface for reading/writing pricing sheets and tabular data.
 */
export class SpreadsheetProvider {
  async readRange(fileId, range, options = {}) {
    throw new Error('SpreadsheetProvider.readRange must be implemented by adapter');
  }

  async writeRange(fileId, range, values, options = {}) {
    throw new Error('SpreadsheetProvider.writeRange must be implemented by adapter');
  }
}

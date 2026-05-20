import fs from 'fs/promises';
import path from 'path';

import { Storage, loadConversationRecord } from '@google/gemini-cli-core';

export interface SessionMetadata {
  sessionId: string;
  status: 'active' | 'archived';
  isPinned: boolean;
  title?: string;
  lastUpdated: string;
}

export class MetadataManager {
  private metadataPath: string;
  private metadata: Record<string, SessionMetadata> = {};
  private storage: Storage;

  constructor(workspaceDir: string) {
    this.metadataPath = path.join(workspaceDir, '.gemini-server-metadata.json');
    this.storage = new Storage(workspaceDir);
  }

  async load() {
    try {
      const data = await fs.readFile(this.metadataPath, 'utf-8');
      this.metadata = JSON.parse(data);
    } catch (e) {
      this.metadata = {};
    }
    await this.storage.initialize();
  }

  async save() {
    await fs.writeFile(this.metadataPath, JSON.stringify(this.metadata, null, 2), 'utf-8');
  }

  /**
   * ファイルシステム（SDKのchatsディレクトリ）をスキャンし、未知のセッションをメタデータに追加します
   */
  async syncWithFileSystem(): Promise<SessionMetadata[]> {
    const chatFiles = await this.storage.listProjectChatFiles();
    const tempDir = this.storage.getProjectTempDir();

    for (const file of chatFiles) {
      const absolutePath = path.join(tempDir, file.filePath);
      
      // メタデータに存在しないセッションのみ処理
      // (IDを特定するためにファイルを読み込む必要がある)
      const conversation = await loadConversationRecord(absolutePath);
      if (conversation && !this.metadata[conversation.sessionId]) {
        this.metadata[conversation.sessionId] = {
          sessionId: conversation.sessionId,
          status: 'archived', // CLI等の外部セッションはデフォルトでアーカイブ扱い
          isPinned: false,
          title: conversation.summary || conversation.messages[0]?.displayContent?.[0]?.text?.slice(0, 30) || 'Legacy Session',
          lastUpdated: conversation.lastUpdated || file.lastUpdated
        };
      }
    }
    await this.save();
    return this.getAllMetadata();
  }

  getMetadata(sessionId: string): SessionMetadata {
    if (!this.metadata[sessionId]) {
      this.metadata[sessionId] = {
        sessionId,
        status: 'archived',
        isPinned: false,
        lastUpdated: new Date().toISOString()
      };
    }
    return this.metadata[sessionId];
  }

  async updateMetadata(sessionId: string, updates: Partial<SessionMetadata>) {
    const current = this.getMetadata(sessionId);
    this.metadata[sessionId] = {
      ...current,
      ...updates,
      sessionId,
      lastUpdated: new Date().toISOString()
    };
    await this.save();
    return this.metadata[sessionId];
  }

  getAllMetadata(): SessionMetadata[] {
    return Object.values(this.metadata);
  }
}

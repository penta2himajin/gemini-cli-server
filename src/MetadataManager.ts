import fs from 'fs/promises';
import path from 'path';

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

  constructor(workspaceDir: string) {
    // ひとまずカレントディレクトリに保存
    this.metadataPath = path.join(workspaceDir, '.gemini-server-metadata.json');
  }

  async load() {
    try {
      const data = await fs.readFile(this.metadataPath, 'utf-8');
      this.metadata = JSON.parse(data);
    } catch (e) {
      this.metadata = {};
    }
  }

  async save() {
    await fs.writeFile(this.metadataPath, JSON.stringify(this.metadata, null, 2), 'utf-8');
  }

  getMetadata(sessionId: string): SessionMetadata {
    if (!this.metadata[sessionId]) {
      // 初期値（CLI等で作成されたセッションはarchived扱い）
      return {
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
      sessionId, // IDは不変
      lastUpdated: new Date().toISOString()
    };
    await this.save();
    return this.metadata[sessionId];
  }

  getAllMetadata(): SessionMetadata[] {
    return Object.values(this.metadata);
  }
}

import { dialog, type BrowserWindow } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import type { DocumentImportResult, DocumentImportTarget } from '../../shared/domain';
import { mapImportedDocument } from '../../shared/document-import';
import { ValidationError } from '../../shared/validation';
import type { ProviderService } from './provider-service';

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.json', '.csv', '.log']);
const IMAGE_MIME = new Map<string, 'image/png' | 'image/jpeg' | 'image/webp'>([
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp']
]);

export class DocumentImportService {
  constructor(private readonly provider: ProviderService) {}

  async selectAndImport(parent: BrowserWindow | undefined, target: DocumentImportTarget): Promise<DocumentImportResult | null> {
    const options = {
      title: '选择需要识别的图片或文件',
      properties: ['openFile'] as Array<'openFile'>,
      filters: [
        { name: '支持的文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'pdf', 'docx', 'txt', 'md', 'markdown', 'json', 'csv', 'log'] },
        { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
        { name: '文档', extensions: ['pdf', 'docx', 'txt', 'md', 'markdown', 'json', 'csv', 'log'] }
      ]
    };
    const selection = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    if (selection.canceled || !selection.filePaths[0]) return null;
    return this.importFile(selection.filePaths[0], target);
  }

  async importFile(filePath: string, target: DocumentImportTarget): Promise<DocumentImportResult> {
    if (!['job', 'profile', 'knowledge'].includes(target)) throw new ValidationError('导入目标无效');
    const info = await stat(filePath);
    if (!info.isFile()) throw new ValidationError('请选择一个有效文件');
    if (info.size <= 0) throw new ValidationError('文件内容为空');
    if (info.size > MAX_FILE_BYTES) throw new ValidationError('文件不能超过 12 MB');

    const extension = path.extname(filePath).toLocaleLowerCase();
    const fileName = path.basename(filePath);
    const buffer = await readFile(filePath);
    let text = '';
    let mode: 'local' | 'ai-vision' = 'local';
    const warnings: string[] = [];

    if (TEXT_EXTENSIONS.has(extension)) {
      text = buffer.toString('utf8');
    } else if (extension === '.docx') {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
      if (result.messages.length) warnings.push('Word 中的复杂排版或图片可能未完整导入。');
    } else if (extension === '.pdf') {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        text = result.text;
      } finally {
        await parser.destroy();
      }
      if (!text.trim()) throw new ValidationError('该 PDF 没有可提取文字；扫描版 PDF 请先转成图片识别');
    } else {
      const mimeType = IMAGE_MIME.get(extension);
      if (!mimeType) throw new ValidationError('仅支持 PNG、JPG、WEBP、PDF、DOCX、TXT、Markdown、JSON、CSV 和 LOG');
      text = await this.provider.recognizeImage(buffer, mimeType, target);
      mode = 'ai-vision';
      warnings.push('图片内容已发送到当前启用的 AI Provider 进行识别。');
    }

    if (!text.trim()) throw new ValidationError('没有从文件中识别出有效文字');
    return mapImportedDocument(target, fileName, text, mode, warnings);
  }
}
